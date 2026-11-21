const os = require("node:os");

const originalUserInfo = os.userInfo;
os.userInfo = (...args) => {
  try {
    return originalUserInfo(...args);
  } catch (error) {
    if (error?.code !== "ERR_SYSTEM_ERROR" || error?.syscall !== "uv_os_get_passwd") throw error;
    return {
      uid: -1,
      gid: -1,
      username: process.env.USERNAME || "user",
      homedir: process.env.USERPROFILE || process.cwd(),
      shell: process.env.ComSpec || "cmd.exe"
    };
  }
};
