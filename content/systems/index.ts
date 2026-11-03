// content/systems/index.ts — register every system file here.
import { docxter } from "./docxter";
import { eduassist } from "./eduassist";
import { fathom } from "./fathom";
import { infraCopilot } from "./infra-copilot";
import { meetingCopilot } from "./meeting-copilot";
import { operator } from "./operator";
import { sequel } from "./sequel";
import { serving } from "./serving";

export const systems = [serving, infraCopilot, sequel, docxter, fathom, eduassist, meetingCopilot, operator];
