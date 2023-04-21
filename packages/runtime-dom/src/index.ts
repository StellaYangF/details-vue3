import { nodeOps } from "./nodeOps";
import { patchProp } from "./patchProp";

export const renderOptions = Object.assign({ patchProp }, nodeOps)
