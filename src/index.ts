import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
dotenv.config();

import { testConnection } from "./config/database";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";

import authRoute from "./routes/auth.route";
import userRoute from "./routes/user.route";
import walletRoute from "./routes/wallet.route";
import paymentRoute from "./routes/payment.route";
import machineRoute from "./routes/machine.route";
import bookingRoute from "./routes/booking.route";
import productRoute from "./routes/product.route";
import announcementRoute from "./routes/announcement.route";
import employeeRoute from "./routes/employee.route";
import adminRoute from "./routes/admin.route";

const app = express();
const PORT = process.env.PORT || 3000;

// ============ Middleware global ============
app.use(helmet());

// CORS dibuka penuh: frontend Flutter (mobile) & web consuming REST API ini
app.use(cors());

// Capture raw body: dibutuhkan untuk verifikasi signature webhook DANA
app.use(
  express.json({
    limit: "10mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Rate limit global: max 300 request / 15 menit per IP
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: { success: false, message: "Terlalu banyak request, coba lagi nanti" },
  })
);

// ============ Routes ============
app.get("/", (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "API Nyucik - Self Service Laundry berjalan 🚀",
    docs: "Lihat README.md untuk daftar endpoint",
    base_url: "/api/v1",
  });
});

app.use("/api/v1/auth", authRoute);
app.use("/api/v1/users", userRoute);
app.use("/api/v1/wallet", walletRoute);
app.use("/api/v1/payments", paymentRoute); // webhook DANA: /api/v1/payments/webhook
app.use("/api/v1/machines", machineRoute);
app.use("/api/v1/bookings", bookingRoute);
app.use("/api/v1/products", productRoute);
app.use("/api/v1/announcements", announcementRoute);
app.use("/api/v1/employees", employeeRoute);
app.use("/api/v1/admin", adminRoute);

// ============ Error handling ============
app.use(notFoundHandler);
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => errorHandler(err, _req, res, _next));

// ============ Start ============
const start = async () => {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
    console.log(`   Base URL API: /api/v1`);
  });
};

start();
