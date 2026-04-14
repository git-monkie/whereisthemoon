import { useEffect, useRef, useState } from "react";
import SunCalc from "suncalc";

export default function App() {
  const videoRef = useRef(null);

  const [started, setStarted] = useState(false);
  const [location, setLocation] = useState(null);
  const [moonInfo, setMoonInfo] = useState(null);

  const [heading, setHeading] = useState(0);
  const [pitch, setPitch] = useState(0);

  const baseHeading = useRef(null);
  const basePitch = useRef(null);

  const filteredHeading = useRef(0);
  const filteredPitch = useRef(0);

  const smoothPos = useRef({ x: 0, y: 0 });

  const normalizeAngle = (a) => {
    a = a % 360;
    if (a < 0) a += 360;
    return a;
  };

  const angleDiff = (a, b) => {
    return ((a - b + 180) % 360) - 180;
  };

  const startApp = async () => {
    try {
      if (
        typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function"
      ) {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== "granted") return;
      }

      setStarted(true);
    } catch (e) {
      console.log(e);
    }
  };

  // 📍 위치
  useEffect(() => {
    if (!started) return;

    navigator.geolocation.getCurrentPosition((pos) => {
      setLocation({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
      });
    });
  }, [started]);

  // 📷 카메라
  useEffect(() => {
    if (!started) return;

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: "environment" },
      })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((e) => console.log("camera error", e));
  }, [started]);

  // 🌙 달 위치
  useEffect(() => {
    if (!location) return;

    const update = () => {
      const now = new Date();

      const moon = SunCalc.getMoonPosition(
        now,
        location.lat,
        location.lon
      );

      let az = (moon.azimuth * 180) / Math.PI;
      az = normalizeAngle(az + 180);

      setMoonInfo({
        azimuth: az,
        altitude: (moon.altitude * 180) / Math.PI,
      });
    };

    update();
    const id = setInterval(update, 2000);
    return () => clearInterval(id);
  }, [location]);

  // 🧭 센서 (완전 안정화)
  useEffect(() => {
    if (!started) return;

    const handle = (e) => {
      let rawH = e.webkitCompassHeading ?? e.alpha ?? 0;
      let rawP = e.beta ?? 0;

      if (baseHeading.current === null) baseHeading.current = rawH;
      if (basePitch.current === null) basePitch.current = rawP;

      let targetH = angleDiff(rawH, baseHeading.current);
      let targetP = rawP - basePitch.current;

      // 🔥 강한 smoothing
      filteredHeading.current += 0.05 * (targetH - filteredHeading.current);
      filteredPitch.current += 0.05 * (targetP - filteredPitch.current);

      // dead zone
      if (Math.abs(filteredHeading.current) < 0.8)
        filteredHeading.current = 0;
      if (Math.abs(filteredPitch.current) < 0.8)
        filteredPitch.current = 0;

      setHeading(filteredHeading.current);
      setPitch(filteredPitch.current);
    };

    window.addEventListener("deviceorientation", handle, true);
    return () =>
      window.removeEventListener("deviceorientation", handle);
  }, [started]);

  // 🌙 좌표 계산
  const getPos = () => {
    if (!moonInfo) return { x: 0, y: 0 };

    let azDiff = angleDiff(moonInfo.azimuth, heading);
    let altDiff = moonInfo.altitude - pitch;

    const target = {
      x: -azDiff * 6,
      y: altDiff * 6,
    };

    const s = 0.08;

    smoothPos.current.x += s * (target.x - smoothPos.current.x);
    smoothPos.current.y += s * (target.y - smoothPos.current.y);

    return smoothPos.current;
  };

  const pos = getPos();

  const recalibrate = () => {
    baseHeading.current = filteredHeading.current;
    basePitch.current = filteredPitch.current;
  };

  // ❗ UI 항상 보이게 구조 수정 (video 아래 / overlay 위)
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      {/* 📷 카메라 */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: 0,
        }}
      />

      {/* 🌙 AR 달 */}
      <div
        style={{
          position: "absolute",
          left: `calc(50% + ${pos.x}px)`,
          top: `calc(50% + ${pos.y}px)`,
          transform: "translate(-50%, -50%)",
          fontSize: 60,
          zIndex: 10,
        }}
      >
        🌙
      </div>

      {/* 📊 DEBUG UI (무조건 보이게 고정) */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 999,
          color: "white",
          fontSize: 14,
          background: "rgba(0,0,0,0.5)",
          padding: 10,
          borderRadius: 8,
        }}
      >
        <div>heading: {heading.toFixed(2)}</div>
        <div>pitch: {pitch.toFixed(2)}</div>
        <div>
          moon az: {moonInfo?.azimuth?.toFixed(2) ?? "loading"}
        </div>
        <div>
          moon alt: {moonInfo?.altitude?.toFixed(2) ?? "loading"}
        </div>
      </div>

      {/* 🎯 보정 버튼 */}
      <button
        onClick={recalibrate}
        style={{
          position: "absolute",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 999,
          padding: "10px 14px",
          background: "rgba(0,0,0,0.6)",
          color: "white",
          borderRadius: 10,
        }}
      >
        방향 재보정
      </button>

      {/* 🚀 시작 버튼 (처음) */}
      {!started && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            background: "linear-gradient(#0b0c2a, #1a1c4a)",
            zIndex: 1000,
          }}
        >
          <button
            onClick={startApp}
            style={{
              width: 200,
              height: 200,
              borderRadius: "50%",
              fontSize: 18,
              color: "white",
              background: "rgba(255,255,255,0.1)",
            }}
          >
            🌙 달 찾기
          </button>
        </div>
      )}
    </div>
  );
}