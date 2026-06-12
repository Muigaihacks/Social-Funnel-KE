const bcrypt = require('bcryptjs');
async function test() {
  const hash = "$2a$11$TeJpwaNl2OHA6TWNBS0sdua7J9TVP8/IC5M/DWtv.5Adinmvm5P9.";
  const password = "socialfunnel@2026";
  const match = await bcrypt.compare(password, hash);
  console.log("Match:", match);
}
test();
