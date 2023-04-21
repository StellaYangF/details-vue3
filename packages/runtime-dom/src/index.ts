import { nodeOps } from "./nodeOps";
import { patchProps } from "./patchProps";

export const renderOptions = Object.assign({ patchProps }, nodeOps)
