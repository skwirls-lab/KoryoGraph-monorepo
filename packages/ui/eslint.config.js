import reactHooks from "eslint-plugin-react-hooks";
import { config } from "@koryo/config/eslint/base";

export default [...config, reactHooks.configs.flat.recommended];
