// content/systems/index.ts — register every system file here.
import { docxter } from "./docxter";
import { dorschGpt } from "./dorsch-gpt";
import { eduassist } from "./eduassist";
import { gsc } from "./gsc";
import { infraCopilot } from "./infra-copilot";
import { meetingCopilot } from "./meeting-copilot";
import { operator } from "./operator";
import { serving } from "./serving";

export const systems = [gsc, serving, docxter, dorschGpt, eduassist, infraCopilot, meetingCopilot, operator];
