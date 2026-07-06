import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meRouter from "./me";
import calendarRouter from "./calendar";
import leaveRequestsRouter from "./leaveRequests";
import notificationsRouter from "./notifications";
import settingsRouter from "./settings";
import teamRouter from "./team";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(meRouter);
router.use(calendarRouter);
router.use(leaveRequestsRouter);
router.use(notificationsRouter);
router.use(settingsRouter);
router.use(teamRouter);
router.use(adminRouter);

export default router;
