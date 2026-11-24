import {DEFAULT_POLICY,validPolicy,classifySlot,TIME_ZONE} from './booking-policy.js';
// Jack's initial approved hours, effective only after live calendar integration
// and an authenticated administrator explicitly enables automatic booking.
export const INITIAL_POLICY=validPolicy({
 ...DEFAULT_POLICY,
 automatic_enabled:false,
 weekdays:{
  "0":[],"1":[["13:30","16:30"]],"2":[["13:30","16:30"]],
  "3":[["13:30","16:30"]],"4":[["13:30","16:30"]],
  "5":[["13:30","16:30"]],"6":[]
 },
 blackouts:[]
});
export {classifySlot,TIME_ZONE};
// Outside these windows, route to existing approval-request flow.
// Never interpret the configured windows as confirmation of calendar availability.
