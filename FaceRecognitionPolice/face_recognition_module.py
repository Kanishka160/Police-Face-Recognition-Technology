
import os
import cv2
import face_recognition
import numpy as np


class PoliceFaceRecognizer:
    def __init__(self, database_dir=None):
        """
        Initialize the face recognition engine and load known faces.
        """
        if database_dir is None:
            database_dir = os.path.abspath(
                os.path.join(os.path.dirname(__file__), "..", "database")
            )

        self.database_dir = os.path.abspath(database_dir)
        self.known_face_encodings = []
        self.known_face_names = []
        self.load_known_faces()

    def load_known_faces(self):
        """
        Load face images from the database folder.
        """
        print("[INFO] Initializing face database...")
        print(f"[INFO] Database path: {self.database_dir}")

        if not os.path.isdir(self.database_dir):
            print(f"[ERROR] Database folder not found: {self.database_dir}")
            return

        valid_extensions = (".jpg", ".jpeg", ".png")

        for file_name in sorted(os.listdir(self.database_dir)):
            if not file_name.lower().endswith(valid_extensions):
                continue

            file_path = os.path.join(self.database_dir, file_name)

            try:
                name = os.path.splitext(file_name)[0]
                name = name.replace("_", " ").title()

                image = face_recognition.load_image_file(file_path)
                encodings = face_recognition.face_encodings(image)

                if encodings:
                    self.known_face_encodings.append(encodings[0])
                    self.known_face_names.append(name)
                    print(f"[SUCCESS] Loaded face: {name}")
                else:
                    print(f"[WARNING] No face detected in {file_name}")

            except Exception as error:
                print(f"[ERROR] Could not process {file_name}: {error}")

        print(
            f"[INFO] Database initialization complete. "
            f"{len(self.known_face_names)} faces loaded."
        )

    def detect_and_recognize(self, query_image_bytes):
        """
        Detect faces and compare them with the loaded database.
        """
        image_array = np.frombuffer(query_image_bytes, dtype=np.uint8)
        img_bgr = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

        if img_bgr is None:
            raise ValueError("Invalid image file or corrupted image.")

        output_img = img_bgr.copy()
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

        face_locations = face_recognition.face_locations(img_rgb)
        face_encodings = face_recognition.face_encodings(
            img_rgb, face_locations
        )

        results = []

        for (top, right, bottom, left), encoding in zip(
            face_locations, face_encodings
        ):
            match_name = "Unknown Person"
            confidence_score = 0.0
            is_match = False

            if self.known_face_encodings:
                distances = face_recognition.face_distance(
                    self.known_face_encodings, encoding
                )

                best_idx = int(np.argmin(distances))
                shortest_distance = float(distances[best_idx])

                print(f"[DEBUG] Best face distance: {shortest_distance:.4f}")

                # Standard starting threshold; validate using test images.
                threshold = 0.6

                if shortest_distance < threshold:
                    match_name = self.known_face_names[best_idx]
                    is_match = True

                    # Similarity estimate, NOT a calibrated probability.
                    confidence_score = max(
                        0.0,
                        (1.0 - shortest_distance) * 100.0
                    )

            box_color = (0, 0, 255) if is_match else (255, 191, 0)

            cv2.rectangle(
                output_img, (left, top), (right, bottom), box_color, 3
            )

            label = f"{match_name} ({confidence_score:.1f}%)"

            label_top = max(0, top - 35)
            cv2.rectangle(
                output_img,
                (left, label_top),
                (right, top),
                box_color,
                cv2.FILLED,
            )

            cv2.putText(
                output_img,
                label,
                (left + 5, max(20, top - 10)),
                cv2.FONT_HERSHEY_DUPLEX,
                0.55,
                (255, 255, 255),
                1,
            )

            results.append({
                "name": match_name,
                "confidence": round(confidence_score, 1),
                "is_match": is_match,
                "box": {
                    "top": top,
                    "right": right,
                    "bottom": bottom,
                    "left": left,
                },
            })

        processed_img_rgb = cv2.cvtColor(
            output_img, cv2.COLOR_BGR2RGB
        )

        return {
            "faces_detected": len(face_locations),
            "matches": results,
            "processed_image": processed_img_rgb,
        }
