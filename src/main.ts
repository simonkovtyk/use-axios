import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import React, { useEffect } from "react";

export type UseAxiosIndicators = {
	isFinished: boolean;
	isAborted: boolean;
	isLoading: boolean;
	isPending: boolean;
	isSuccess: boolean;
	isError: boolean;
	isConcurrencyFailure: boolean;
}

export type UseAxiosState<T = any, C = any, R = AxiosResponse<T>> = {
	response: R | null,
	error: AxiosError<C> | null;
	abort: (reason?: any) => void;
} & UseAxiosIndicators;

export type UseAxiosReturn<T = any, C = any, R = AxiosResponse<T>, D = any> = [
	((data?: AxiosRequestConfig<D>) => Promise<R>), UseAxiosState<T, C, R>
];

export type UseAxiosOptions<T = any, R = AxiosResponse<T>> = {
	instance?: AxiosInstance;
	immediate?: boolean;
	intercept?: (value: Promise<R>) => Promise<R>;
	preventConcurrent?: boolean;
}

const RESET_STATE_FLAGS: UseAxiosIndicators = {
	isFinished: false,
	isAborted: false,
	isLoading: false,
	isPending: false,
	isSuccess: false,
	isError: false,
	isConcurrencyFailure: false
}

export function useAxios<T = any, C = any, R = AxiosResponse<T>, D = any>(
	requestConfig: AxiosRequestConfig<D>,
	options?: { immediate: true; } & UseAxiosOptions<T, R>
): UseAxiosState<T, C, R>;
export function useAxios<T = any, C = any, R = AxiosResponse<T>, D = any>(
	requestConfig: AxiosRequestConfig<D>,
	options?: UseAxiosOptions<T, R>
): UseAxiosReturn<T, C, R, D>;
export function useAxios<T = any, C = any, R = AxiosResponse<T>, D = any> (
	requestConfig: AxiosRequestConfig<D>,
	options?: UseAxiosOptions<T, R>
): UseAxiosReturn<T, C, R, D> | UseAxiosState<T, C, R> {
	let abortController = new AbortController();
	const invocationCount = React.useRef(0);

	function abort (reason?: any) {
		abortController.abort(reason);
		setState((curr) => ({
			...curr,
			...RESET_STATE_FLAGS,
			isAborted: true
		}));
		abortController = new AbortController();
	}

	const [state, setState] = React.useState<UseAxiosState<T, C, R>>({
		...RESET_STATE_FLAGS,
		abort,
		response: null,
		error: null,
		isPending: true
	});

	function request (config?: AxiosRequestConfig<D>) {
		const mergedConfig = {...requestConfig, ...config, signal: abortController.signal};

		const request = (options?.instance || axios).request<T, R, D>(mergedConfig);
		const maybeIntercepted = options?.intercept === undefined ? request : options.intercept(request);

		setState((curr) => ({
			...curr,
			...RESET_STATE_FLAGS,
			isLoading: true
		}));

		return new Promise<R>((resolve, reject) => {
			console.log(invocationCount);
			if (options?.preventConcurrent && invocationCount.current !== 0) {
				setState((curr) => ({
					...curr,
					...RESET_STATE_FLAGS,
					isConcurrencyFailure: true
				}));

				const error = new AxiosError("Concurrency failure", "ERROR_CONCURRENCY_FAILURE", config as InternalAxiosRequestConfig<D>);

				reject(error);

				return;
			}

			++invocationCount.current;

			maybeIntercepted.then((response) => {
				setState((curr) => ({
					...curr,
					...RESET_STATE_FLAGS,
					isFinished: true,
					isSuccess: true,
					response
				}));
				resolve(response);
			})
			.catch((error) => {
				console.log(error);
				setState((curr) => ({
					...curr,
					...RESET_STATE_FLAGS,
					isFinished: true,
					isError: true,
					error
				}))
				reject(error);
			})
			.finally(() => {
				--invocationCount.current;
			});
		});
	}

	if (options?.immediate) {
		useEffect(() => {
			request(requestConfig);
		}, []);

		return state;
	}

	return [request, state];
}
