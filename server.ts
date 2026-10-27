import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import twilio from "twilio";

// Load environment variables
dotenv.config();

// Paths
const RECORDS_FILE_PATH = path.join(process.cwd(), "public", "database", "records.json");
const DATABASE_DIR = path.join(process.cwd(), "public", "database");

// Ensure directories exist immediately at startup
if (!fs.existsSync(DATABASE_DIR)) {
  fs.mkdirSync(DATABASE_DIR, { recursive: true });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set request body size limit to 50MB to handle base64 images safely
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Ensure records.json exists
  if (!fs.existsSync(RECORDS_FILE_PATH)) {
    fs.writeFileSync(RECORDS_FILE_PATH, JSON.stringify([], null, 2));
  }

  // Initialize Gemini API
  const apiKey = process.env.GEMINI_API_KEY;
  let ai: GoogleGenAI | null = null;

  if (apiKey) {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }

  // API Routes

  /**
   * GET /api/criminals
   * Retrieve the current database of criminal/missing person records
   */
  app.get("/api/criminals", (req, res) => {
    try {
      if (!fs.existsSync(RECORDS_FILE_PATH)) {
        return res.json([]);
      }
      const data = fs.readFileSync(RECORDS_FILE_PATH, "utf8");
      let records = JSON.parse(data);
      
      // Auto-migrate any legacy record to have dbType
      let migrated = false;
      records = records.map((rec: any) => {
        if (!rec.dbType) {
          rec.dbType = "criminal";
          migrated = true;
        }
        return rec;
      });
      if (migrated) {
        fs.writeFileSync(RECORDS_FILE_PATH, JSON.stringify(records, null, 2));
      }

      res.json(records);
    } catch (error: any) {
      console.error("Error reading criminal database:", error);
      res.status(500).json({ error: "Failed to retrieve criminal database." });
    }
  });

  /**
   * POST /api/criminals/add
   * Add a new criminal/missing person record with an image to the database
   */
  app.post("/api/criminals/add", (req, res) => {
    try {
      const {
        name,
        alias,
        age,
        gender,
        wantedFor,
        riskLevel,
        status,
        physicalDescription,
        lastSeen,
        imageBase64,
        dbType,
      } = req.body;

      if (!name || !imageBase64) {
        return res.status(400).json({ error: "Name and image are required." });
      }

      // Process base64 image data
      const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ error: "Invalid image format." });
      }

      const imageBuffer = Buffer.from(matches[2], "base64");
      const timestamp = Date.now();
      const filename = `criminal_custom_${timestamp}.jpg`;
      const imagePathOnDisk = path.join(DATABASE_DIR, filename);

      // Save image to the database directory
      fs.writeFileSync(imagePathOnDisk, imageBuffer);

      // Read current records
      let records = [];
      if (fs.existsSync(RECORDS_FILE_PATH)) {
        const fileData = fs.readFileSync(RECORDS_FILE_PATH, "utf8");
        records = JSON.parse(fileData);
      }

      // Create new record
      const newRecord = {
        id: `custom_${timestamp}`,
        name,
        alias: alias || "No Alias",
        age: age ? parseInt(age) : 30,
        gender: gender || "Unknown",
        wantedFor: wantedFor || "No specified crimes",
        riskLevel: riskLevel || "Low",
        status: status || "Wanted",
        physicalDescription: physicalDescription || "No physical description provided",
        lastSeen: lastSeen || "Unknown",
        imagePath: `/database/${filename}`,
        dbType: dbType || "criminal",
      };

      records.push(newRecord);
      fs.writeFileSync(RECORDS_FILE_PATH, JSON.stringify(records, null, 2));

      res.json({ success: true, record: newRecord });
    } catch (error: any) {
      console.error("Error adding criminal record:", error);
      res.status(500).json({ error: "Failed to add record." });
    }
  });

  /**
   * Helper function to dispatch alerts (email and/or SMS)
   */
  async function sendNotificationAlert(
    matchResult: any,
    matchedRecord: any,
    alertConfig: any
  ) {
    let logOutput = "";
    const locationStr = alertConfig?.location || "HQ Front Entrance Cam-1";
    const thresholdVal = alertConfig?.threshold ?? 80;
    const recipients = Array.isArray(alertConfig?.recipients)
      ? alertConfig.recipients
      : alertConfig?.recipients
      ? alertConfig.recipients.split(",").map((r: string) => r.trim()).filter(Boolean)
      : [];

    const dbLabel = matchedRecord?.dbType === "missing_person" ? "Missing Persons Database" : "Criminal Database";

    logOutput += `--- BIOMETRIC DISPATCH INITIATED ---\n`;
    logOutput += `Triggered by Match: ${matchResult.matchedName} (${matchResult.confidenceScore}% confidence)\n`;
    logOutput += `Database Source: ${dbLabel}\n`;
    logOutput += `Detection Location: ${locationStr}\n`;
    logOutput += `Configured Target Threshold: ${thresholdVal}%\n`;
    logOutput += `Target Recipients: ${recipients.join(", ")}\n`;

    let emailDispatched = false;
    let smsDispatched = false;

    // 1. Send Email Notification
    if (alertConfig?.sendEmail && recipients.length > 0) {
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpFrom = process.env.SMTP_FROM_EMAIL || "alerts@metro-police-department.gov";

      const emailSubject = `🚨 LAW ENFORCEMENT ALERT: Face Match Found (${matchResult.matchedName}) at ${locationStr}`;
      const emailBodyHTML = `
        <div style="font-family: sans-serif; max-width: 600px; border: 3px solid #dc2626; padding: 20px; border-radius: 8px; background-color: #fbfbfb;">
          <h2 style="color: #dc2626; margin-top: 0; font-family: monospace; letter-spacing: 1px;">🚨 METROPOLITAN POLICE DEPARTMENT ALERT</h2>
          <p>This is an automated biometric detection alert from the MPD Tactical Facial Recognition & Surveillance System.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13px;">
            <tr style="background-color: #f1f5f9;">
              <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #cbd5e1; width: 40%;">MATCHED NAME:</td>
              <td style="padding: 10px; border-bottom: 1px solid #cbd5e1; font-weight: bold;">${matchedRecord.name.toUpperCase()}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #cbd5e1;">ALIAS:</td>
              <td style="padding: 10px; border-bottom: 1px solid #cbd5e1;">&ldquo;${matchedRecord.alias}&rdquo;</td>
            </tr>
            <tr style="background-color: #f1f5f9;">
              <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #cbd5e1;">DATABASE SOURCE:</td>
              <td style="padding: 10px; border-bottom: 1px solid #cbd5e1; font-weight: bold; color: #1d4ed8;">${dbLabel.toUpperCase()}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #cbd5e1;">CONFIDENCE SCORE:</td>
              <td style="padding: 10px; border-bottom: 1px solid #cbd5e1; font-weight: bold; color: #dc2626; font-size: 16px;">${matchResult.confidenceScore}%</td>
            </tr>
            <tr style="background-color: #f1f5f9;">
              <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #cbd5e1;">DETECTION LOCATION:</td>
              <td style="padding: 10px; border-bottom: 1px solid #cbd5e1;">${locationStr}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #cbd5e1;">AGE / GENDER:</td>
              <td style="padding: 10px; border-bottom: 1px solid #cbd5e1;">${matchedRecord.age} / ${matchedRecord.gender.toUpperCase()}</td>
            </tr>
            <tr style="background-color: #f1f5f9;">
              <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #cbd5e1;">STATUS / RISK:</td>
              <td style="padding: 10px; border-bottom: 1px solid #cbd5e1; font-weight: bold; color: #b91c1c;">${matchedRecord.status.toUpperCase()} (${matchedRecord.riskLevel.toUpperCase()} RISK)</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #cbd5e1;">RECORDED DETAILS:</td>
              <td style="padding: 10px; border-bottom: 1px solid #cbd5e1; color: #ef4444;">${matchedRecord.wantedFor}</td>
            </tr>
            <tr style="background-color: #f1f5f9;">
              <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #cbd5e1;">PHYSICAL LANDMARKS:</td>
              <td style="padding: 10px; border-bottom: 1px solid #cbd5e1;">${matchedRecord.physicalDescription}</td>
            </tr>
          </table>

          <div style="margin-top: 15px; padding: 12px; background-color: #fef2f2; border-left: 5px solid #dc2626; font-size: 12px; font-family: monospace; line-height: 1.5; color: #7f1d1d;">
            <strong>🚨 REACTION INSTRUCTIONS:</strong><br/>
            ${matchResult.policeAlert}
          </div>
        </div>
      `;

      if (smtpHost && smtpUser && smtpPass) {
        try {
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
          });

          await transporter.sendMail({
            from: smtpFrom,
            to: recipients.join(", "),
            subject: emailSubject,
            html: emailBodyHTML,
          });

          emailDispatched = true;
          logOutput += `[EMAIL SUCCESS] Dispatched email to [${recipients.join(", ")}] via SMTP ${smtpHost}.\n`;
        } catch (err: any) {
          console.error("Nodemailer error:", err);
          logOutput += `[EMAIL FAILURE] SMTP connection error: ${err.message}.\n`;
        }
      } else {
        logOutput += `[EMAIL NOTIFICATION LOG] (SMTP keys missing from env. Custom SMTP is needed for actual transmission). Subject: "${emailSubject}"\n`;
      }
    }

    // 2. Send SMS Notification
    if (alertConfig?.sendSMS && recipients.length > 0) {
      const twilioSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioFrom = process.env.TWILIO_FROM_NUMBER;

      const smsMessage = `🚨 MPD BIOMETRIC ALERT: Match found in ${dbLabel}: ${matchedRecord.name.toUpperCase()} (${matchResult.confidenceScore}%) at ${locationStr}. Risk: ${matchedRecord.riskLevel}. Directives: ${matchResult.policeAlert}`;

      if (twilioSid && twilioToken && twilioFrom) {
        try {
          const client = twilio(twilioSid, twilioToken);
          for (const r of recipients) {
            // Check if looks like a valid phone number
            if (r.match(/^\+?[0-9\-\s\(\)]{8,20}$/)) {
              await client.messages.create({
                body: smsMessage,
                from: twilioFrom,
                to: r,
              });
              smsDispatched = true;
              logOutput += `[SMS SUCCESS] Transmitted alert to ${r} via Twilio.\n`;
            } else {
              logOutput += `[SMS SKIP] Recipient "${r}" is not a valid phone structure. Skipping.\n`;
            }
          }
        } catch (err: any) {
          console.error("Twilio error:", err);
          logOutput += `[SMS FAILURE] Twilio error: ${err.message}.\n`;
        }
      } else {
        logOutput += `[SMS NOTIFICATION LOG] (Twilio credentials missing from env). SMS Text: "${smsMessage}"\n`;
      }
    }

    logOutput += `--- DISPATCH COMPLETE ---\n`;
    console.log(logOutput);
    return { emailDispatched, smsDispatched, logOutput };
  }

  /**
   * POST /api/recognize
   * Compare uploaded suspect image with stored records using Gemini API
   */
  app.post("/api/recognize", async (req, res) => {
    try {
      const { imageBase64, searchDatabase = "both", alertConfig } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: "Suspect image base64 is required." });
      }

      if (!ai) {
        return res.status(500).json({
          error: "Gemini API client not initialized. Please verify your GEMINI_API_KEY in secrets.",
        });
      }

      // Process suspect base64 image
      const suspectMatches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!suspectMatches || suspectMatches.length !== 3) {
        return res.status(400).json({ error: "Invalid suspect image format." });
      }
      const suspectMimeType = suspectMatches[1];
      const suspectData = suspectMatches[2];

      // Read current database records
      let allRecords = [];
      if (fs.existsSync(RECORDS_FILE_PATH)) {
        const fileData = fs.readFileSync(RECORDS_FILE_PATH, "utf8");
        allRecords = JSON.parse(fileData);
      }

      // Auto-migrate records to make sure they have a dbType
      allRecords = allRecords.map((rec: any) => {
        if (!rec.dbType) rec.dbType = "criminal";
        return rec;
      });

      // Filter based on searchDatabase choice
      let filteredRecords = allRecords;
      if (searchDatabase === "criminal") {
        filteredRecords = allRecords.filter((r: any) => r.dbType === "criminal");
      } else if (searchDatabase === "missing_person") {
        filteredRecords = allRecords.filter((r: any) => r.dbType === "missing_person");
      }

      if (filteredRecords.length === 0) {
        const dbString = searchDatabase === "both" ? "Criminals and Missing Persons" : searchDatabase === "criminal" ? "Criminals Only" : "Missing Persons Only";
        return res.json({
          faceDetected: true,
          matchFound: false,
          matchedId: "unknown",
          matchedName: "Unknown Person",
          matchedDatabase: "none",
          confidenceScore: 0,
          facialFeatures: {
            faceShape: "Unknown",
            eyeColor: "Unknown",
            hairStyle: "Unknown",
            facialHair: "Unknown",
            ageEstimation: 30,
            distinguishingMarks: "None",
          },
          boundingBox: { x: 25, y: 25, width: 50, height: 50 },
          biometricMetrics: {
            eyeDistanceRatio: 0.5,
            noseWidthRatio: 0.4,
            jawAngleDegrees: 110,
            facialSymmetryScore: 85,
          },
          technicalAnalysis: `No records exist in the selected [${dbString}] database structure for comparison.`,
          policeAlert: "Selected target database contains zero records. No biometric reference possible.",
        });
      }

      // Prepare content parts for the multimodal request
      const parts: any[] = [];
      let promptReferenceDescriptions = "Here is the list of biometric reference photos from our police database:\n";

      // Dynamically load image file data for each registered filtered record
      filteredRecords.forEach((rec: any, idx: number) => {
        const partIndex = idx + 1;
        const localImagePath = path.join(process.cwd(), "public", rec.imagePath);

        if (fs.existsSync(localImagePath)) {
          try {
            const imgBuffer = fs.readFileSync(localImagePath);
            const base64Img = imgBuffer.toString("base64");
            
            parts.push({
              inlineData: {
                data: base64Img,
                mimeType: "image/jpeg",
              },
            });
            const dbName = rec.dbType === "missing_person" ? "Missing Persons Database" : "Criminals Database";
            promptReferenceDescriptions += `- Reference Part Index ${partIndex}: Photo of ID '${rec.id}' in '${dbName}', Name '${rec.name}', Alias '${rec.alias}', Status/Risk Details: '${rec.wantedFor}', Risk Level '${rec.riskLevel}', Physical Description: '${rec.physicalDescription}'\n`;
          } catch (readErr) {
            console.error(`Error loading image for record ${rec.id}:`, readErr);
          }
        }
      });

      // Add suspect query photo as the final image part
      parts.push({
        inlineData: {
          data: suspectData,
          mimeType: suspectMimeType,
        },
      });
      const suspectPartIndex = parts.length; // The last part is the suspect

      const promptText = `You are an advanced Biometric Facial Recognition AI for the Metropolitan Police Department.
You have been provided with reference photos of known criminals/suspects/missing persons from the police records, and a query photo of an unknown suspect captured from a camera feed or upload.

${promptReferenceDescriptions}
- Query Image Part Index ${suspectPartIndex}: This is the uploaded query image of the suspect that we need to analyze and attempt to match.

TASK INSTRUCTIONS:
1. First, detect if a human face exists in the Query Image (Part Index ${suspectPartIndex}). If no human face exists at all, return faceDetected = false, matchFound = false, and matchedId = "none".
2. If a face is found, carefully analyze its facial landmarks, bone structure, eye shape and spacing, jawline angle, forehead, nose proportions, hair color, facial hair, and approximate age.
3. Compare the query suspect face against all reference photos provided in the part indices.
4. Determine if there is a match with any of the reference profiles. We require high visual similarity (landmarks match, facial features match) for a match.
5. If there is a match (similarity exceeds 70%), set matchedId to the ID of the matching record, matchFound = true, and matchedName to the person's name.
6. If the query face is clearly detected but does not match any reference photos in the database, set matchedId = "unknown", matchedName = "Unknown Person", and matchFound = false.
7. Return:
   - "faceDetected": boolean
   - "matchFound": boolean
   - "matchedId": matching database record ID (e.g. 'criminal1', etc.) or 'unknown' or 'none'
   - "matchedName": matching person's name, 'Unknown Person', or 'No Face Detected'
   - "matchedDatabase": "criminal" or "missing_person" or "none" (must specify which database type the matched ID belongs to, as indicated in the list above)
   - "confidenceScore": number (0 to 100), representing match certainty. If unmatched, represent similarity of the closest match, or 0.
   - "facialFeatures": key metrics parsed from the query face (faceShape, eyeColor, hairStyle, facialHair, ageEstimation, distinguishingMarks)
   - "boundingBox": normalized coordinates (0-100) of the face rectangle detected in the Query Image: { x: number, y: number, width: number, height: number } where x and y are top-left corner percentages.
   - "biometricMetrics": simulated distance ratios (eyeDistanceRatio: 0-1, noseWidthRatio: 0-1, jawAngleDegrees: 70-150, facialSymmetryScore: 0-100) based on facial shape analysis.
   - "technicalAnalysis": a professional, 2-3 sentence technical facial biometric analysis detailing matching landmarks, bone structure, forehead curvature, and other points of convergence or divergence.
   - "policeAlert": a police-grade command center warning. For matched high/medium-risk criminals, write an active alert with danger rating and arrest guidelines. For missing persons, write a humanitarian locator warning requesting immediate contact. For unmatched persons, write a normal clearance notice.

OUTPUT SCHEMA (Must be strictly valid JSON):
{
  "faceDetected": boolean,
  "matchFound": boolean,
  "matchedId": string,
  "matchedName": string,
  "matchedDatabase": string,
  "confidenceScore": number,
  "facialFeatures": {
    "faceShape": string,
    "eyeColor": string,
    "hairStyle": string,
    "facialHair": string,
    "ageEstimation": number,
    "distinguishingMarks": string
  },
  "boundingBox": {
    "x": number,
    "y": number,
    "width": number,
    "height": number
  },
  "biometricMetrics": {
    "eyeDistanceRatio": number,
    "noseWidthRatio": number,
    "jawAngleDegrees": number,
    "facialSymmetryScore": number
  },
  "technicalAnalysis": string,
  "policeAlert": string
}`;

      parts.push({ text: promptText });

      // Query Gemini
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: parts,
        config: {
          responseMimeType: "application/json",
        },
      });

      const resultText = response.text || "{}";
      const cleanedJson = resultText.trim().replace(/^```json\s*/i, "").replace(/```$/, "");
      const resultObj = JSON.parse(cleanedJson);

      // Server-side database verification to avoid Gemini hallucinatory database label mismatch
      let matchedRecord = null;
      if (resultObj.matchFound && resultObj.matchedId && resultObj.matchedId !== "unknown" && resultObj.matchedId !== "none") {
        matchedRecord = allRecords.find((r: any) => r.id === resultObj.matchedId);
        if (matchedRecord) {
          resultObj.matchedName = matchedRecord.name;
          resultObj.matchedDatabase = matchedRecord.dbType || "criminal";
        }
      }

      // Check if alert triggers
      let dispatchResult = null;
      const thresholdVal = alertConfig?.threshold ?? 80;
      if (resultObj.matchFound && matchedRecord && resultObj.confidenceScore >= thresholdVal) {
        if (alertConfig?.enabled) {
          dispatchResult = await sendNotificationAlert(resultObj, matchedRecord, alertConfig);
        }
      }

      // Add alert dispatch results to output payload
      res.json({
        ...resultObj,
        alertDispatched: !!dispatchResult,
        alertLog: dispatchResult?.logOutput || "",
        alertChannels: {
          email: !!dispatchResult?.emailDispatched,
          sms: !!dispatchResult?.smsDispatched,
        }
      });
    } catch (error: any) {
      console.error("Error during facial recognition pipeline:", error);
      res.status(500).json({ error: "Failed to process face recognition analysis: " + error.message });
    }
  });

  // Vite Setup & Production Static Serving
  const isProd = process.env.NODE_ENV === "production";

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Start Server
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Police Biometrics Command Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Fatal server initialization error:", err);
});
