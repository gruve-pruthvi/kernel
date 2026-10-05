// content/systems/index.ts — register every system file here.
import { atlas } from "./atlas";
import { beacon } from "./beacon";
import { ledger } from "./ledger";
import { relay } from "./relay";

export const systems = [atlas, relay, beacon, ledger];
