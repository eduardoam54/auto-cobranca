'use client';

import { useEffect, useState } from 'react';
import { apiRequest, ApiError } from './api';
import { getToken } from './auth';

type ApiState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

export function useApiData<T>(path: string) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!getToken()) {
      window.location.assign('/login');
      return;
    }

    let active = true;

    apiRequest<T>(path)
      .then((data) => {
        if (active) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        setState({
          data: null,
          loading: false,
          error:
            error instanceof ApiError
              ? error.message
              : 'Nao foi possivel carregar os dados.',
        });
      });

    return () => {
      active = false;
    };
  }, [path]);

  return state;
}
