import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore.js";
import isBetween from "dayjs/plugin/isBetween.js";

// Enable UTC globally
dayjs.extend(utc);
dayjs.extend(isSameOrBefore);
dayjs.extend(isBetween);

// Always export configured instance
export default dayjs;