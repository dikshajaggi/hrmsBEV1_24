import { getAllEmployees } from "./emp_services.js";

export async function getAllEmp(req, res) {
  try {
    const employees = await getAllEmployees();
    res.json(employees);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}