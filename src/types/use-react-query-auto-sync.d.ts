// types written by Claude. may be inaccurate. use at your own risk!!!

declare module "use-react-query-auto-sync" {
    import {
        QueryKey,
        UseMutationOptions,
        UseQueryOptions,
    } from "@tanstack/react-query";

    interface AutoSaveOptions {
        wait?: number;
    }

    interface UseReactQueryAutoSyncOptions<TData = unknown, TError = unknown> {
        queryOptions: Omit<
            UseQueryOptions<TData, TError>,
            "queryKey" | "queryFn"
        > & {
            queryKey: QueryKey;
            queryFn: () => Promise<TData>;
        };
        mutationOptions: Omit<
            UseMutationOptions<TData, TError, string>,
            "mutationFn"
        > & {
            mutationFn: (content: string) => Promise<TData>;
        };
        autoSaveOptions?: AutoSaveOptions;
    }

    interface UseReactQueryAutoSyncResult<_TData = unknown> {
        draft: string;
        setDraft: (value: string) => void;
        queryResult: { isPending: boolean };
    }

    export function useReactQueryAutoSync<TData = unknown, TError = unknown>(
        options: UseReactQueryAutoSyncOptions<TData, TError>,
    ): UseReactQueryAutoSyncResult<TData>;
}
