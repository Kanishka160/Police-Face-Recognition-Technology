"""
Police Department Facial Recognition Dashboard
----------------------------------------------
A Streamlit web application that serves as a Tactical Command Center for matching
suspect uploads against a local known criminal/missing database folder.

Author: Police Biometrics Unit
Date: 2026-07-13
"""

import streamlit as st
import os
from PIL import Image
import io
from face_recognition_module import PoliceFaceRecognizer

# Set Page Config for a professional tactical feel
st.set_page_config(
    page_title="Metro Police Biometrics Dashboard",
    page_icon="👮",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom Tactical Styles (Cyberpunk Dark Command Center Theme)
st.markdown("""
<style>
    .reportview-container {
        background-color: #0b0f19;
    }
    .main {
        background-color: #0c101b;
        color: #e2e8f0;
    }
    h1, h2, h3 {
        color: #38bdf8 !important;
        font-family: 'Courier New', Courier, monospace;
    }
    .stAlert {
        border-radius: 8px;
    }
    .criminal-alert {
        background-color: #7f1d1d;
        color: #fca5a5;
        padding: 15px;
        border-left: 5px solid #ef4444;
        border-radius: 5px;
        font-weight: bold;
        margin-bottom: 15px;
    }
    .clear-alert {
        background-color: #064e3b;
        color: #a7f3d0;
        padding: 15px;
        border-left: 5px solid #10b981;
        border-radius: 5px;
        font-weight: bold;
        margin-bottom: 15px;
    }
    .info-tile {
        background-color: #1e293b;
        padding: 15px;
        border-radius: 8px;
        border: 1px solid #334155;
    }
</style>
""", unsafe_allow_html=True)

# App Sidebar
st.sidebar.image("https://img.icons8.com/nolan/128/security-shield.png", width=100)
st.sidebar.title("👮 Tactical HUD")
st.sidebar.markdown("---")

DATABASE_DIR = "database"

# Initialize Face Recognition Engine
@st.cache_resource
def get_recognizer():
    return PoliceFaceRecognizer(database_dir=DATABASE_DIR)

recognizer = get_recognizer()

# Sidebar Statistics and Database Status
st.sidebar.subheader("🗄️ Database Metrics")
if os.path.exists(DATABASE_DIR):
    known_criminals = [f for f in os.listdir(DATABASE_DIR) if f.lower().endswith(('.jpg', '.png', '.jpeg'))]
    st.sidebar.metric(label="Registered Mugshots", value=len(known_criminals))
    
    # List known individuals
    if len(known_criminals) > 0:
        st.sidebar.write("### 📂 Monitored Profiles:")
        for idx, filename in enumerate(known_criminals):
            name = os.path.splitext(filename)[0].replace("_", " ").title()
            st.sidebar.text(f"{idx+1}. {name}")
    else:
        st.sidebar.warning("No files in 'database/' folder.")
else:
    st.sidebar.error("Database folder 'database/' not found.")

st.sidebar.markdown("---")
st.sidebar.info(
    "**System Status**: ACTIVE\n\n"
    "This system processes biometrics under standard local jurisdiction regulations."
)

# Main Dashboard Title
st.title("🛡️ METROPOLITAN POLICE DEPARTMENT")
st.subheader("Facial Recognition & Criminal Identification Command Center")
st.markdown("---")

# Main Content Grid
col1, col2 = st.columns([1, 1])

with col1:
    st.markdown("### 📸 Biometric Input Feed")
    st.write("Upload a suspect, missing person, or surveillance frame to execute facial matching.")
    
    # File Uploader
    uploaded_file = st.file_uploader(
        "Choose an image...", 
        type=["jpg", "jpeg", "png"],
        help="Upload standard JPG, JPEG, or PNG facial images. Enforce good facial lighting."
    )
    
    if uploaded_file is not None:
        try:
            # Read bytes
            image_bytes = uploaded_file.read()
            uploaded_image = Image.open(io.BytesIO(image_bytes))
            
            # Display uploaded suspect photo
            st.image(uploaded_image, caption="Uploaded suspect image.", use_container_width=True)
            
            # Submit button
            run_button = st.button("🔴 EXECUTE BIOMETRIC SEARCH", use_container_width=True)
        except Exception as e:
            st.error(f"Error loading uploaded file: {str(e)}")

with col2:
    st.markdown("### 🖥️ Real-time Analysis Output")
    
    if uploaded_file is not None and 'run_button' in locals() and run_button:
        with st.spinner("⚡ Initializing Biometric Alignment... Extracting Encodings..."):
            try:
                # Execute identification pipeline
                results = recognizer.detect_and_recognize(image_bytes)
                
                # Check results
                faces_count = results["faces_detected"]
                
                if faces_count == 0:
                    st.warning("⚠️ No Face Detected! Please upload an image with a clear view of the face.")
                    st.markdown("""
                        <div class="info-tile">
                            <strong>Biometric Quality Control Failed:</strong><br>
                            The uploaded file has failed primary landmark alignment. 
                            Ensure the suspect's face is fully visible, well-lit, and facing forward.
                        </div>
                    """, unsafe_allow_html=True)
                else:
                    st.success(f"🎯 Biometric alignment successful. {faces_count} face(s) isolated.")
                    
                    # Display the processed image with bounding boxes
                    st.image(
                        results["processed_image"], 
                        caption="Biometric HUD Scan Overlay", 
                        use_container_width=True
                    )
                    
                    # Match summaries
                    for idx, match in enumerate(results["matches"]):
                        st.markdown(f"#### Biometric Target #{idx+1}")
                        
                        if match["is_match"]:
                            # Display RED ALERT for criminal match
                            alert_html = f"""
                            <div class="criminal-alert">
                                🚨 ACTIVE RED ALERT: MATCH FOUND IN DATABASE<br>
                                TARGET MATCHED: {match['name']}<br>
                                MATCH CONFIDENCE: {match['confidence']}%
                            </div>
                            """
                            st.markdown(alert_html, unsafe_allow_html=True)
                            
                            # Standard response protocols
                            st.markdown(f"""
                            <div class="info-tile">
                                <strong>Match Verification Protocols:</strong><br>
                                <ul>
                                    <li><strong>Subject ID</strong>: {match['name'].upper()}</li>
                                    <li><strong>Confidence</strong>: {match['confidence']}% Match Probability</li>
                                    <li><strong>Legal Directive</strong>: Confirm identity with secondary fingerprint/biometric alignment before dispatching arrest units.</li>
                                </ul>
                            </div>
                            """, unsafe_allow_html=True)
                        else:
                            # Display Green CLEAR for unknown person
                            clear_html = f"""
                            <div class="clear-alert">
                                🟢 BIOMETRIC SEARCH COMPLETE: UNKNOWN INDIVIDUAL<br>
                                NO CRIMINAL RECORD DETECTED<br>
                                CLOSEST PROFILE MATCH: {match['name']} ({match['confidence']}%)
                            </div>
                            """
                            st.markdown(clear_html, unsafe_allow_html=True)
                            
                            st.markdown("""
                            <div class="info-tile">
                                <strong>Biometric Assessment:</strong><br>
                                Subject is not registered in the active wanted criminal database directory. No further action required.
                            </div>
                            """, unsafe_allow_html=True)
                            
            except Exception as e:
                st.error(f"Execution Error: {str(e)}")
                st.info("Check if your database images are clean and contain visible faces.")
    else:
        st.info("Awaiting input image upload and action signal.")
        st.markdown("""
        <div style="background-color: #111827; padding: 20px; border-radius: 8px; border: 1px dashed #4b5563;">
            <h5>📋 Operating Instructions</h5>
            <ol>
                <li>Ensure files in the <code>database/</code> folder are named after the criminals (e.g. <code>al_capone.jpg</code>).</li>
                <li>Upload an image in the left panel.</li>
                <li>Click <strong>EXECUTE BIOMETRIC SEARCH</strong> to trigger the detection and matching model.</li>
            </ol>
        </div>
        """, unsafe_allow_html=True)
