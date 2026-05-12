import queryString from "query-string";
import { ApiError } from "./api-error";

export const sendRequest = async <T>(props: IRequest): Promise<T> => {
  let {
    url,
    method,
    body,
    queryParams = {},
    useCredentials = false,
    headers = {},
    nextOption = {},
  } = props;

  const options: RequestInit = {
    method: method,
    headers: new Headers({ "content-type": "application/json", ...headers }),
    body: body ? JSON.stringify(body) : null,
    ...nextOption,
  };
  if (useCredentials) options.credentials = "include";

  if (queryParams) {
    url = `${url}?${queryString.stringify(queryParams)}`;
  }

  // console.log("Fetching URL:", url);

  const res = await fetch(url, options);

  if (res.ok) {
    return res.json() as T;
  }

  const json = await res.json().catch(() => ({ message: res.statusText, error: "" }));
  throw new ApiError(
    res.status,
    json?.message ?? "",
    json?.error ?? "",
  );
};

export const sendRequestFile = async <T>(props: IRequest): Promise<T> => {
  let {
    url,
    method,
    body,
    queryParams = {},
    useCredentials = false,
    headers = {},
    nextOption = {},
  } = props;

  const options: RequestInit = {
    method: method,
    headers: new Headers({ ...headers }),
    body: body ? body as BodyInit : null,
    ...nextOption,
  };
  if (useCredentials) options.credentials = "include";

  if (queryParams) {
    url = `${url}?${queryString.stringify(queryParams)}`;
  }

  const res = await fetch(url, options);

  if (res.ok) {
    return res.json() as T;
  }

  const json = await res.json().catch(() => ({ message: res.statusText, error: "" }));
  throw new ApiError(
    res.status,
    json?.message ?? "",
    json?.error ?? "",
  );
};
