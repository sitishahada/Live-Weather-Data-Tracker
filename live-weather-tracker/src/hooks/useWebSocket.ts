import { useEffect, useState } from "react";

const useWebSocket = (url: string) => {
  const [data, setData] = useState<any[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    const socket = new WebSocket(url);

    socket.onopen = () => console.log("WebSocket Connected ✅");
    socket.onmessage = (event) => {
      console.log("Received Data:", event.data);
      setData((prev) => [...prev, ...JSON.parse(event.data)]);
    };
    socket.onclose = () => console.log("WebSocket Disconnected ❌");
    socket.onerror = (error) => console.error("WebSocket Error:", error);

    setWs(socket);

    return () => {
      socket.close();
    };
  }, [url]);

  return { data, ws };
};

export default useWebSocket;
