# 🚔 Police Face Recognition Technology

An AI-powered face recognition project designed to explore how Computer Vision and Machine Learning can support identity matching and record management in law-enforcement workflows.

The system uses Python, OpenCV, and a dlib-based face recognition library to detect faces, compare them against registered reference images, and display potential matches through a user interface.

## 📌 Project Overview

Manual identification and record searching can be time-consuming. This project demonstrates a computer-vision-based approach to face detection and matching against a local reference database.

The application is intended as an educational prototype to demonstrate facial recognition, image processing, database-based matching, and web interface integration.

## ✨ Key Features

- **Face Detection:** Detects faces in supported images using computer vision.
- **Face Recognition:** Compares detected faces with registered reference images to identify potential matches.
- **Database-Based Matching:** Uses a local collection of reference images and associated records.
- **Interactive Dashboard:** Provides a Streamlit interface for interacting with the face recognition application.
- **Web Interface:** Includes a React and TypeScript-based interface.
- **Visual Results:** Displays recognition results to help users review potential matches.
- **Modular Design:** Separates recognition logic and interface components for easier maintenance.

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| Python | Core application and recognition logic |
| OpenCV | Image processing and computer vision |
| face_recognition | Face encoding and matching |
| dlib | Facial feature representation used by the recognition library |
| NumPy | Numerical and image-array operations |
| Streamlit | Interactive Python dashboard |
| React.js | Web interface components |
| TypeScript | Type-safe frontend development |
| Node.js | JavaScript development environment and server-side tooling |

## ⚙️ How It Works

1. **Image Input:** The user provides an image containing a face.
2. **Face Detection:** The application locates the face in the input image.
3. **Face Encoding:** The recognition library generates a numerical representation of the detected face.
4. **Database Comparison:** The generated representation is compared with registered reference faces.
5. **Match Evaluation:** The application evaluates potential matches using the configured recognition threshold.
6. **Result Display:** The interface presents the result for further human review.

> A recognition result is a potential match, not proof of identity.

## 📂 Project Structure

```text
Police-Face-Recognition-Technology/
│
├── FaceRecognitionPolice/   # Python face recognition application
├── database/                # Local reference images and records
├── src/                     # Web interface source files
├── .env.example             # Example environment configuration
├── .gitignore
├── index.html
├── package.json
├── server.ts
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 🚀 Getting Started

### Prerequisites

Install the following software before running the project:

- Python
- Node.js and npm
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/Kanishka160/Police-Face-Recognition-Technology.git
cd Police-Face-Recognition-Technology
```

### 2. Set Up the Python Application

Open a terminal in the Python project directory:

```powershell
cd FaceRecognitionPolice
python -m venv venv
.\venv\Scripts\Activate.ps1
```

Install the required Python dependencies:

```powershell
pip install -r requirements.txt
```

Start the Streamlit application:

```powershell
streamlit run app.py
```

If a dependency installation error occurs, follow the relevant package's installation instructions, especially for dlib on Windows.

### 3. Run the Web Interface

Open a second terminal in the repository root directory:

```powershell
npm install
npm run dev
```

Open the local URL displayed in the terminal.

The Python application and web interface may require separate terminals, depending on the configured integration.

## 🗃️ Reference Database

The recognition system compares input faces against registered reference images.

For local testing:

- Use consented images or synthetic test data.
- Follow the image naming and record format expected by the application.
- Verify recognition results manually.
- Keep private face images and sensitive personal records out of public repositories.

## 🔐 Privacy and Responsible Use

Facial recognition involves sensitive biometric information. This project is intended for educational and demonstration purposes.

- Use images only with appropriate authorization.
- Do not publish real criminal records or private biometric data.
- Do not treat a face match as evidence of criminal activity.
- Require independent human verification before taking any consequential action.
- Recognize that lighting, image quality, camera angle, and model limitations can affect results.

This prototype is not a substitute for a validated, audited, production-grade law-enforcement system.

## 🎯 Project Objectives

- Explore Computer Vision and Machine Learning applications.
- Understand face detection, encoding, and similarity-based matching.
- Integrate a Python recognition workflow with interactive interfaces.
- Demonstrate database-based reference matching.
- Study the benefits, limitations, and responsible use of facial recognition technology.

## 🔮 Future Enhancements

- Improve recognition reliability through systematic testing.
- Add secure authentication and role-based access control.
- Introduce audit logs for database searches and recognition events.
- Improve database management and record validation.
- Evaluate performance using consented test datasets and suitable metrics.

## 👩‍💻 Author

**Kanishka Raj**

B.Tech — Artificial Intelligence and Machine Learning

[GitHub Profile](https://github.com/Kanishka160)

