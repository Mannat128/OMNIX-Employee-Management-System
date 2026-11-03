
import re
from pathlib import Path

import easyocr
import fitz
import numpy as np


# Initialize EasyOCR only once
reader = None


def get_ocr_reader():
    global reader

    if reader is None:
        reader = easyocr.Reader(
            ["en"],
            gpu=False
        )

    return reader


# Skills to identify in resumes
SKILLS_LIST = [
    "Python",
    "Java",
    "JavaScript",
    "React",
    "Node.js",
    "FastAPI",
    "Django",
    "Flask",
    "MongoDB",
    "MySQL",
    "PostgreSQL",
    "SQL",
    "HTML",
    "CSS",
    "Machine Learning",
    "Deep Learning",
    "Artificial Intelligence",
    "Data Analysis",
    "Pandas",
    "NumPy",
    "Power BI",
    "Excel",
    "AWS",
    "Docker",
    "Git",
    "GitHub",
    "C++",
    "C",
    "TypeScript",
    "Express.js",
    "TensorFlow",
    "PyTorch",
    "Scikit-learn",
    "Communication"
]


# Extract text from image
def extract_text_from_image(image_path):
    """
    Extract text from JPG, JPEG and PNG using EasyOCR.
    """

    ocr_reader = get_ocr_reader()

    results = ocr_reader.readtext(
        str(image_path),
        detail=0,
        paragraph=True
    )

    return "\n".join(results)


# Extract text from PDF
def extract_text_from_pdf(pdf_path):
    """
    Convert PDF pages into images and extract text using EasyOCR.
    """

    ocr_reader = get_ocr_reader()

    extracted_pages = []

    try:
        pdf_document = fitz.open(pdf_path)

        try:
            if pdf_document.is_encrypted:
                raise ValueError("Password-protected PDFs are not supported")

            if len(pdf_document) == 0:
                raise ValueError("PDF contains no pages")

            for page in pdf_document:

                # Convert PDF page into image
                pix = page.get_pixmap(
                    matrix=fitz.Matrix(2, 2),
                    alpha=False
                )

                image = np.frombuffer(
                    pix.samples,
                    dtype=np.uint8
                ).reshape(
                    pix.height,
                    pix.width,
                    pix.n
                )

                # Extract text using EasyOCR
                results = ocr_reader.readtext(
                    image,
                    detail=0,
                    paragraph=True
                )

                extracted_pages.append(
                    "\n".join(results)
                )

        finally:
            pdf_document.close()

    except Exception as error:
        raise ValueError(
            f"PDF processing failed: {str(error)}"
        ) from error

    return "\n\n".join(extracted_pages)


# Extract resume information
def extract_resume_data(text):
    """
    Extract name, email, phone number and skills from resume text.
    """

    # Extract email
    email_match = re.search(
        r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
        text
    )

    email = (
        email_match.group(0).lower()
        if email_match
        else None
    )

    # Extract Indian mobile number
    phone_match = re.search(
        r"(?<!\d)(?:\+91[-.\s]?)?[6-9]\d{9}(?!\d)",
        text
    )

    phone = (
        phone_match.group(0)
        if phone_match
        else None
    )

    # Extract possible name from first few lines
    lines = [
        line.strip()
        for line in text.splitlines()
        if line.strip()
    ]

    name = None

    excluded_headings = {
        "resume",
        "curriculum vitae",
        "cv",
        "profile",
        "contact",
        "personal details",
        "professional summary"
    }

    for line in lines[:5]:

        cleaned_line = re.sub(
            r"\s+",
            " ",
            line
        ).strip()

        if (
            len(cleaned_line) <= 60
            and cleaned_line.lower() not in excluded_headings
            and re.fullmatch(
                r"[A-Za-z][A-Za-z .'-]{0,59}",
                cleaned_line
            )
            and "@" not in cleaned_line
        ):
            name = cleaned_line
            break

    # Identify skills
    skills = []

    for skill in SKILLS_LIST:

        # Match complete skill names rather than partial words
        pattern = (
            r"(?<![A-Za-z0-9])"
            + re.escape(skill)
            + r"(?![A-Za-z0-9])"
        )

        if re.search(pattern, text, re.IGNORECASE):
            skills.append(skill)

    return {
        "name": name,
        "email": email,
        "phone": phone,
        "skills": skills,
        "education": [],
        "experience": []
    }


# Main OCR processing function
def process_document(file_path):
    """
    Main OCR function.
    Supports PDF, JPG, JPEG and PNG.
    """

    file_path = Path(file_path)

    if not file_path.is_file():
        raise FileNotFoundError(
            "Document file not found"
        )

    extension = file_path.suffix.lower()

    if extension == ".pdf":

        extracted_text = extract_text_from_pdf(
            file_path
        )

    elif extension in [".jpg", ".jpeg", ".png"]:

        extracted_text = extract_text_from_image(
            file_path
        )

    else:
        raise ValueError(
            "Unsupported document format"
        )

    if not extracted_text.strip():
        raise ValueError(
            "No text could be extracted from document"
        )

    # Extract resume details
    extracted_data = extract_resume_data(
        extracted_text
    )

    return {
        "extracted_text": extracted_text,
        "extracted_data": extracted_data
    }
