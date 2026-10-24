import {
  CountRequest,
  CountResponse,
  FacetsResponse,
  NlDescribeRequest,
  NlDescribeResponse,
  NlParseRequest,
  NlParseResponse,
  NlRefineRequest,
  NlRefineResponse,
  PresetsResponse,
  ResultsRequest,
  ResultsResponse,
  SaveScreenRequest,
  SavedScreen,
  SavedScreensResponse,
  SearchResponse,
  StockDetailResponse,
  UpdateScreenRequest,
  type CountResponse as CountResponseType,
  type FacetsResponse as FacetsResponseType,
  type NlDescribeRequest as NlDescribeRequestType,
  type NlDescribeResponse as NlDescribeResponseType,
  type NlParseRequest as NlParseRequestType,
  type NlParseResponse as NlParseResponseType,
  type NlRefineRequest as NlRefineRequestType,
  type NlRefineResponse as NlRefineResponseType,
  type PresetsResponse as PresetsResponseType,
  type ResultsResponse as ResultsResponseType,
  type SaveScreenRequest as SaveScreenRequestType,
  type SavedScreen as SavedScreenType,
  type SavedScreensResponse as SavedScreensResponseType,
  type ScreenSpec,
  type SearchResponse as SearchResponseType,
  type StockDetailResponse as StockDetailResponseType,
  type UpdateScreenRequest as UpdateScreenRequestType,
} from "screener-contract";

export interface ScreenerApi {
  count(spec: ScreenSpec, signal?: AbortSignal): Promise<CountResponseType>;
  results(spec: ScreenSpec, signal?: AbortSignal): Promise<ResultsResponseType>;
  getFacets(signal?: AbortSignal): Promise<FacetsResponseType>;
  getPresets(signal?: AbortSignal): Promise<PresetsResponseType>;
  getStockDetail(ticker: string, signal?: AbortSignal): Promise<StockDetailResponseType>;
  searchStocks(q: string, signal?: AbortSignal): Promise<SearchResponseType>;
  parseNl(body: NlParseRequestType, signal?: AbortSignal): Promise<NlParseResponseType>;
  describeNl(
    body: NlDescribeRequestType,
    signal?: AbortSignal,
  ): Promise<NlDescribeResponseType>;
  refineNl(
    body: NlRefineRequestType,
    signal?: AbortSignal,
  ): Promise<NlRefineResponseType>;
  listScreens(signal?: AbortSignal): Promise<SavedScreensResponseType>;
  saveScreen(body: SaveScreenRequestType, signal?: AbortSignal): Promise<SavedScreenType>;
  updateScreen(
    id: number,
    body: UpdateScreenRequestType,
    signal?: AbortSignal,
  ): Promise<SavedScreenType>;
  deleteScreen(id: number, signal?: AbortSignal): Promise<void>;
}

export interface ScreenerApiOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

/** Map network / HTTP failures to a short user-facing message. */
export function screenerRequestErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof DOMException && err.name === "AbortError") {
    return fallback;
  }
  if (err instanceof TypeError) {
    // fetch() network failure (backend down, CORS, DNS, etc.)
    return "Couldn't reach the server";
  }
  if (err instanceof Error) {
    const msg = err.message;
    if (/failed to fetch|networkerror|load failed|econnrefused/i.test(msg)) {
      return "Couldn't reach the server";
    }
    if (/^Request failed \((502|503|504)\)/.test(msg)) {
      return "Couldn't reach the server";
    }
    return msg || fallback;
  }
  return fallback;
}

/**
 * Turn a non-2xx response into a user-facing Error. The API's own `{ error }`
 * message wins — e.g. NL endpoints answer 502/503 with the provider's reason
 * ("Invalid API key", "OPENROUTER_MODEL is not set"). A 502–504 with no such
 * body means the API itself is unreachable behind the proxy.
 */
async function responseError(response: Response): Promise<Error> {
  if (response.status === 401) {
    return new Error("Log in to save screens");
  }
  let serverMessage: string | undefined;
  try {
    const errBody = (await response.json()) as { error?: string };
    serverMessage = errBody.error;
  } catch {
    // Non-JSON body (e.g. the dev proxy's own error page) — fall through.
  }
  if (serverMessage) {
    return new Error(serverMessage);
  }
  if (response.status === 502 || response.status === 503 || response.status === 504) {
    return new Error("Couldn't reach the server");
  }
  return new Error(`Request failed (${response.status})`);
}

async function getJson<T>(
  url: string,
  schema: { parse: (data: unknown) => T },
  fetchFn: typeof fetch,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetchFn(url, { signal, credentials: "same-origin" });
  } catch (err) {
    throw new Error(screenerRequestErrorMessage(err, "Couldn't reach the server"));
  }

  if (!response.ok) {
    throw await responseError(response);
  }

  const data: unknown = await response.json();
  return schema.parse(data);
}

async function postJson<T>(
  url: string,
  body: unknown,
  schema: { parse: (data: unknown) => T },
  fetchFn: typeof fetch,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
      signal,
    });
  } catch (err) {
    throw new Error(screenerRequestErrorMessage(err, "Couldn't reach the server"));
  }

  if (!response.ok) {
    throw await responseError(response);
  }

  const data: unknown = await response.json();
  return schema.parse(data);
}

async function putJson<T>(
  url: string,
  body: unknown,
  schema: { parse: (data: unknown) => T },
  fetchFn: typeof fetch,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetchFn(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
      signal,
    });
  } catch (err) {
    throw new Error(screenerRequestErrorMessage(err, "Couldn't reach the server"));
  }

  if (!response.ok) {
    throw await responseError(response);
  }

  const data: unknown = await response.json();
  return schema.parse(data);
}

async function deleteRequest(
  url: string,
  fetchFn: typeof fetch,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetchFn(url, {
      method: "DELETE",
      credentials: "same-origin",
      signal,
    });
  } catch (err) {
    throw new Error(screenerRequestErrorMessage(err, "Couldn't reach the server"));
  }

  if (!response.ok) {
    throw await responseError(response);
  }
}

/** Live REST client — swap with `createMockScreenerApi` for MSW/offline. */
export function createLiveScreenerApi(options: ScreenerApiOptions = {}): ScreenerApi {
  const baseUrl = options.baseUrl ?? "";
  const fetchFn = options.fetchFn ?? fetch;

  return {
    async count(spec, signal) {
      const body = CountRequest.parse(spec);
      return postJson(`${baseUrl}/api/screen/count`, body, CountResponse, fetchFn, signal);
    },

    async results(spec, signal) {
      const body = ResultsRequest.parse(spec);
      return postJson(`${baseUrl}/api/screen/results`, body, ResultsResponse, fetchFn, signal);
    },

    async getFacets(signal) {
      return getJson(`${baseUrl}/api/facets`, FacetsResponse, fetchFn, signal);
    },

    async getPresets(signal) {
      return getJson(`${baseUrl}/api/presets`, PresetsResponse, fetchFn, signal);
    },

    async getStockDetail(ticker, signal) {
      return getJson(
        `${baseUrl}/api/stocks/${encodeURIComponent(ticker)}`,
        StockDetailResponse,
        fetchFn,
        signal,
      );
    },

    async searchStocks(q, signal) {
      const params = new URLSearchParams({ q });
      return getJson(
        `${baseUrl}/api/stocks/search?${params.toString()}`,
        SearchResponse,
        fetchFn,
        signal,
      );
    },

    async parseNl(body, signal) {
      const payload = NlParseRequest.parse(body);
      return postJson(
        `${baseUrl}/api/nl/parse`,
        payload,
        NlParseResponse,
        fetchFn,
        signal,
      );
    },

    async describeNl(body, signal) {
      const payload = NlDescribeRequest.parse(body);
      return postJson(
        `${baseUrl}/api/nl/describe`,
        payload,
        NlDescribeResponse,
        fetchFn,
        signal,
      );
    },

    async refineNl(body, signal) {
      const payload = NlRefineRequest.parse(body);
      return postJson(
        `${baseUrl}/api/nl/refine`,
        payload,
        NlRefineResponse,
        fetchFn,
        signal,
      );
    },

    async listScreens(signal) {
      return getJson(
        `${baseUrl}/api/screens`,
        SavedScreensResponse,
        fetchFn,
        signal,
      );
    },

    async saveScreen(body, signal) {
      const payload = SaveScreenRequest.parse(body);
      return postJson(
        `${baseUrl}/api/screens`,
        payload,
        SavedScreen,
        fetchFn,
        signal,
      );
    },

    async updateScreen(id, body, signal) {
      const payload = UpdateScreenRequest.parse(body);
      return putJson(
        `${baseUrl}/api/screens/${id}`,
        payload,
        SavedScreen,
        fetchFn,
        signal,
      );
    },

    async deleteScreen(id, signal) {
      await deleteRequest(`${baseUrl}/api/screens/${id}`, fetchFn, signal);
    },
  };
}

/** Singleton used by hooks — replace in tests via `setScreenerApi`. */
let screenerApi: ScreenerApi = createLiveScreenerApi();

export function getScreenerApi(): ScreenerApi {
  return screenerApi;
}

export function setScreenerApi(api: ScreenerApi): void {
  screenerApi = api;
}
