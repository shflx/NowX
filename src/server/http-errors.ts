// 鉴权与资源访问的错误：由 API 入口统一转换为 HTTP 状态码，前端据此跳转登录页、改密页或展示 404。

/** 未登录或会话失效（401） */
export class UnauthenticatedError extends Error {
  constructor() {
    super("未登录");
  }
}

/** 需要先修改初始密码（403） */
export class MustChangePasswordError extends Error {
  constructor() {
    super("请先修改初始密码");
  }
}

/** 资源不存在或无权访问（404），无权访问的项目同样按不存在处理 */
export class NotFoundError extends Error {
  constructor(message = "页面不存在或无权访问") {
    super(message);
  }
}
