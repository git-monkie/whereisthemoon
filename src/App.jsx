import { useEffect, useRef, useState } from "react";
import SunCalc from "suncalc";

function App() {
  const videoRef = useRef(null);

  const [started, setStarted] = useState(false);
  const [location, setLocation] = useState(null);
  const [moonInfo, setMoonInfo] = useState(null);

  const [heading, setHeading] = useState(0);
  const [pitch, setPitch] = useState(0);

  const baseHeading = useRef(null);
  const basePitch = useRef(null);

  // 🔥 smoothing용 내부 상태
  const filteredHeading = useRef(0);
  const filteredPitch = useRef(0);

  const smoothPos = useRef({ x: 0, y: 0 });

  const normalizeAngle = (a) => {
    a = a % 360;
    if (a < 0) a += 360;
    return a;
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

  // 📍 위치 (1회)
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
        video: { facingMode: { ideal: "environment" } },
      })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });
  }, [started]);

  // 🌙 달 위치
  useEffect(() => {
    if (!location) return;

    const update = () => {
      const now = new Date();

      const moon = SunCalc.getMoonPosition(now, location.lat, location.lon);

      let az = (moon.azimuth * 180) / Math.PI;
      az = normalizeAngle(az + 180);

      setMoonInfo({
        azimuth: az,
        altitude: moon.altitude * (180 / Math.PI),
      });
    };

    update();
    const id = setInterval(update, 2000);
    return () => clearInterval(id);
  }, [location]);

  // 🧭 센서 (🔥 핵심: drift + smoothing)
  useEffect(() => {
    if (!started) return;

    const alpha = 0.15; // heading smoothing
    const deadZone = 0.5;

    const handle = (e) => {
      let rawH = e.webkitCompassHeading ?? e.alpha ?? 0;
      let rawP = e.beta ?? 0;

      // 기준 설정
      if (baseHeading.current === null) baseHeading.current = rawH;
      if (basePitch.current === null) basePitch.current = rawP;

      let targetH = normalizeAngle(rawH - baseHeading.current);
      let targetP = rawP - basePitch.current;

      // dead zone (미세 흔들림 제거)
      if (Math.abs(targetH) < deadZone) targetH = 0;
      if (Math.abs(targetP) < deadZone) targetP = 0;

      // 🔥 EMA smoothing (핵심)
      filteredHeading.current +=
        alpha * (targetH - filteredHeading.current);

      filteredPitch.current +=
        alpha * (targetP - filteredPitch.current);

      setHeading(filteredHeading.current);
      setPitch(filteredPitch.current);
    };

    window.addEventListener("deviceorientation", handle, true);
    return () =>
      window.removeEventListener("deviceorientation", handle);
  }, [started]);

  // 🌙 좌표 계산 (🔥 smoothing 포함)
  const getPos = () => {
    if (!moonInfo) return { x: 0, y: 0 };

    let azDiff = moonInfo.azimuth - heading;

    if (azDiff > 180) azDiff -= 360;
    if (azDiff < -180) azDiff += 360;

    let altDiff = moonInfo.altitude - pitch;

    const target = {
      x: -azDiff * 6, // sensitivity ↑
      y: altDiff * 6,
    };

    // 🔥 position smoothing
    const s = 0.12;

    smoothPos.current.x += s * (target.x - smoothPos.current.x);
    smoothPos.current.y += s * (target.y - smoothPos.current.y);

    return smoothPos.current;
  };

  const pos = getPos();

  // 🎯 캘리브레이션 (추가 기능)
  const recalibrate = () => {
    baseHeading.current = filteredHeading.current;
    basePitch.current = filteredPitch.current;
  };

  if (!started) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          background: "linear-gradient(#0b0c2a, #1a1c4a)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <button
          onClick={startApp}
          style={{
            width: 200,
            height: 200,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.1)",
            color: "white",
            fontSize: 18,
          }}
        >
          🌙<br />달님,<br />어디있어요?
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      {/* 📷 카메라 */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: 0,
        }}
      />

      {/* 🌙 달 */}
      <div
        style={{
          position: "absolute",
          left: `calc(50% + ${pos.x}px)`,
          top: `calc(50% + ${pos.y}px)`,
          transform: "translate(-50%, -50%)",
          fontSize: 50,
          zIndex: 2,
        }}
      >
        🌙
      </div>

      {/* 🎯 캘리브레이션 버튼 */}
      <button
        onClick={recalibrate}
        style={{
          position: "absolute",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          padding: "10px 16px",
          borderRadius: 10,
          background: "rgba(0,0,0,0.5)",
          color: "white",
          zIndex: 3,
        }}
      >
        방향 보정
      </button>
    </div>
  );
}

export default App;