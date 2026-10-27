export interface CriminalRecord {
  id: string;
  name: string;
  alias: string;
  age: number;
  gender: string;
  wantedFor: string;
  riskLevel: string;
  status: string;
  physicalDescription: string;
  lastSeen: string;
  imagePath: string;
  dbType?: "criminal" | "missing_person";
}

export interface FacialFeatures {
  faceShape: string;
  eyeColor: string;
  hairStyle: string;
  facialHair: string;
  ageEstimation: number;
  distinguishingMarks: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BiometricMetrics {
  eyeDistanceRatio: number;
  noseWidthRatio: number;
  jawAngleDegrees: number;
  facialSymmetryScore: number;
}

export interface BiometricScanResult {
  faceDetected: boolean;
  matchFound: boolean;
  matchedId: string;
  matchedName: string;
  matchedDatabase?: "criminal" | "missing_person" | "none";
  confidenceScore: number;
  facialFeatures: FacialFeatures;
  boundingBox: BoundingBox;
  biometricMetrics: BiometricMetrics;
  technicalAnalysis: string;
  policeAlert: string;
}

export interface SystemLog {
  timestamp: string;
  type: "info" | "warning" | "alert" | "success";
  message: string;
}
