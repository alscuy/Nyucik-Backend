export {
  registerSchema,
  verifyOtpSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
} from "./auth.validator";
export {
  washingMachineSchema,
  dryingMachineSchema,
  machineStatusSchema,
} from "./machine.validator";
export { createBookingSchema, updateStatusSchema } from "./booking.validator";
export { purchaseSchema, productSchema } from "./product.validator";
export {
  announcementSchemaBase,
  announcementSchema,
  employeeSchema,
  expenseSchema,
} from "./content.validator";
