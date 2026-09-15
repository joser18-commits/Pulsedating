import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pulseRouter from "./pulse";
import storageRouter from "./storage";
import discoveryRouter from "./discovery";

const router: IRouter = Router();

router.use(healthRouter);
router.use(pulseRouter);
router.use(discoveryRouter);
router.use(storageRouter);

export default router;
