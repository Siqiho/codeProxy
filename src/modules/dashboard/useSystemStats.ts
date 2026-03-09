import { useEffect, useRef, useState, useCallback } from "react";
import { computeManagementApiBase } from "@/lib/connection";

export interface SystemStats {
    db_size_bytes: number;
    log_size_bytes: number;
    process_mem_bytes: number;
    process_mem_pct: number;
    process_cpu_pct: number;
    go_routines: number;
    go_heap_bytes: number;
    system_cpu_pct: number;
    system_mem_total: number;
    system_mem_used: number;
    system_mem_pct: number;
    net_bytes_sent: number;
    net_bytes_recv: number;
    net_send_rate: number;
    net_recv_rate: number;
    uptime_seconds: number;
    start_time: string;
    channel_latency: ChannelLatency[];
}

export interface ChannelLatency {
    source: string;
    count: number;
    avg_ms: number;
}

/** Build WebSocket URL from the current connection's API base */
function buildWsUrl(): string | null {
    // Read apiBase + managementKey from localStorage (same as login page stores)
    const raw = localStorage.getItem("connection");
    if (!raw) return null;
    try {
        const conn = JSON.parse(raw) as { apiBase?: string; managementKey?: string };
        if (!conn.apiBase) return null;
        const httpBase = computeManagementApiBase(conn.apiBase);
        if (!httpBase) return null;
        // Convert http(s) to ws(s)
        const abs = new URL(httpBase, window.location.origin);
        abs.protocol = abs.protocol === "https:" ? "wss:" : "ws:";
        abs.pathname += "/system-stats/ws";
        // Auth via query param (WebSocket doesn't support custom headers)
        if (conn.managementKey) {
            abs.searchParams.set("token", conn.managementKey);
        }
        return abs.toString();
    } catch {
        return null;
    }
}

export function useSystemStats(interval = 3): {
    stats: SystemStats | null;
    connected: boolean;
    error: string | null;
} {
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

    const connect = useCallback(() => {
        const url = buildWsUrl();
        if (!url) {
            setError("无法构建 WebSocket URL");
            return;
        }

        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            setConnected(true);
            setError(null);
            // Send initial interval preference
            ws.send(JSON.stringify({ interval }));
        };

        ws.onmessage = (ev) => {
            try {
                const data = JSON.parse(ev.data as string) as SystemStats;
                setStats(data);
            } catch {
                // ignore malformed messages
            }
        };

        ws.onerror = () => {
            setError("WebSocket 连接错误");
        };

        ws.onclose = () => {
            setConnected(false);
            wsRef.current = null;
            // Auto-reconnect in 3s
            reconnectTimer.current = setTimeout(connect, 3000);
        };
    }, [interval]);

    useEffect(() => {
        connect();
        return () => {
            clearTimeout(reconnectTimer.current);
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [connect]);

    // If interval changes, notify the server
    useEffect(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ interval }));
        }
    }, [interval]);

    return { stats, connected, error };
}
