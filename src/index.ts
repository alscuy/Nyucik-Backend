import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
dotenv.config();

import { testConnection } from "./config/database";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";

import authRoute from "./routes/auth.route";
import userRoute from "./routes/user.route";
import walletRoute from "./routes/wallet.route";
import machineRoute from "./routes/machine.route";
import bookingRoute from "./routes/booking.route";
import productRoute from "./routes/product.route";
import announcementRoute from "./routes/announcement.route";
import employeeRoute from "./routes/employee.route";
import adminRoute from "./routes/admin.route";
import storeRoute from "./routes/store.route";

const app = express();
const PORT = process.env.PORT || 3000;

export default app;

app.use(helmet());

app.use(cors());

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.get("/", (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "API Nyucik - Self Service Laundry berjalan ",
    docs: "Lihat README.md untuk daftar endpoint",
    base_url: "/api/v1",
  });
});

app.use("/api/v1/auth", authRoute);
app.use("/api/v1/users", userRoute);
app.use("/api/v1/wallet", walletRoute);
app.use("/api/v1/machines", machineRoute);
app.use("/api/v1/bookings", bookingRoute);
app.use("/api/v1/products", productRoute);
app.use("/api/v1/announcements", announcementRoute);
app.use("/api/v1/employees", employeeRoute);
app.use("/api/v1/admin", adminRoute);
app.use("/api/v1/store", storeRoute);

app.use(notFoundHandler);
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => errorHandler(err, _req, res, _next));

const start = async () => {
  await testConnection();
  app.listen(PORT, () => {
    console.log(` Server berjalan di http://localhost:${PORT}`);
    console.log(`   Base URL API: /api/v1`);
  });
};

if (require.main === module) {
  start();
}
