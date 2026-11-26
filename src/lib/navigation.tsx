// 站内导航：基于 React Router 的链接与路由 Hook。
// 链接使用 href 写法，scroll={false} 表示跳转后保留滚动位置（筛选、打开任务详情等场景）。
import type { ComponentProps } from "react";
import {
  Link as RouterLink,
  useLocation,
  useNavigate,
  useParams as useRouterParams,
  useSearchParams as useRouterSearchParams,
} from "react-router";

import { queryClient } from "./query";

/** 导航时保留滚动位置 */
export type NavigationState = { preserveScroll?: boolean };

type LinkProps = Omit<ComponentProps<typeof RouterLink>, "to"> & {
  href: string;
  /** false 表示跳转后不滚动到顶部 */
  scroll?: boolean;
};

export function Link({ href, scroll = true, ...props }: LinkProps) {
  const state: NavigationState | undefined = scroll ? undefined : { preserveScroll: true };
  return <RouterLink to={href} state={state} {...props} />;
}

type NavigateOptions = { scroll?: boolean };

export function useRouter() {
  const navigate = useNavigate();
  const go = (href: string, replace: boolean, { scroll = true }: NavigateOptions = {}) =>
    navigate(href, { replace, state: scroll ? undefined : ({ preserveScroll: true } satisfies NavigationState) });

  return {
    push: (href: string, options?: NavigateOptions) => void go(href, false, options),
    replace: (href: string, options?: NavigateOptions) => void go(href, true, options),
    /** 重新加载当前页面的数据 */
    refresh: () => void queryClient.invalidateQueries(),
    back: () => void navigate(-1),
  };
}

export function usePathname() {
  return useLocation().pathname;
}

export function useSearchParams() {
  return useRouterSearchParams()[0];
}

export function useParams<T extends Record<string, string | undefined>>() {
  return useRouterParams() as T;
}
