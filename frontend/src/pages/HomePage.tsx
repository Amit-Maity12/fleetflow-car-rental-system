
import { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";

type Health = {
  status: string;
  service: string;
};

export default function HomePage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axiosClient
      .get("/health")
      .then((res) => setHealth(res.data.data))
      .catch(() =>
        setError("Cannot reach the backend. Is it running on port 8080?")
      );
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50">
      <h1 className="text-3xl font-bold">FleetFlow</h1>
      <p className="text-gray-600">
        Car Rental & Fleet Management System
      </p>

      {health && (
        <p className="text-green-700">
          Backend status: {health.status} ({health.service})
        </p>
      )}

      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
