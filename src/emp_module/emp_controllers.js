import { getAllEmployees, processBulkUpload } from "./emp_services.js";

export async function getAllEmp(req, res) {
  try {
    const employees = await getAllEmployees();
    res.json(employees);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

/*
  Controller for handling Excel upload.

  Responsibilities:
  - Receive uploaded file
  - Validate presence of file
  - Call service layer
  - Return result to client
*/
export async function bulkUploadEmployees(req, res) {
  try {
    // multer stores uploaded file in memory buffer
    const fileBuffer = req.file?.buffer;

    if (!fileBuffer) {
      return res.status(400).json({
        message: "Excel file is required"
      });
    }

     const adminId = req.user.id

    const dryRun = req.query.dryRun === "true"

    
    // Call service that performs all parsing and DB work
    const result = await processBulkUpload(
      req.file.buffer,
      { adminId, dryRun }
    )

    return res.status(200).json({
      success: true,
      message: dryRun
        ? "Preview generated successfully"
        : "Bulk upload completed",
      data: result
    });

  } catch (error) {
    console.error("Bulk Upload Error:", error);

    res.status(500).json({
      message: error.message || "Bulk upload failed"
    });
  }
}