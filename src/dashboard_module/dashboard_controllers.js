import { getDashboardData } from "./dashboard_services.js";

export async function getDashboard(req, res) {
  try {
    const data = await getDashboardData(req.user);
    res.json(data);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}