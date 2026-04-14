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

  const normalizeAngle = (a) => {
    a = a % 360;
    if (a < 0) a += 360;
    return a;
  };

  const startApp = async () => {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      await DeviceOrientationEvent.requestPermission();
    }
    setStarted(true);
  };

  // 위치
  useEffect(() => {
    if (!started) return;

    navigator.geolocation.getCurrentPosition((pos) => {
      setLocation({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
      });
    });
  }, [started]);

  // 카메라 (🔥 핵심 수정)
  useEffect(() => {
    if (!started) return;

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
      })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });
  }, [started]);

  // 달
  useEffect(() => {
    if (!location) return;

    const update = () => {
      const now = new Date();

      const moon = SunCalc.getMoonPosition(
        now,
        location.lat,
        location.lon
      );

      let az = moon.azimuth * (180 / Math.PI);
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

  // 센서 (🔥 핵심 수정)
  useEffect(() => {
    if (!started) return;

    const handle = (e) => {
      let h = e.alpha || 0;
      let p = e.beta || 0;

      // 기준값 저장
      if (baseHeading.current === null) baseHeading.current = h;
      if (basePitch.current === null) basePitch.current = p;

      // 상대값으로 변경
      h = normalizeAngle(h - baseHeading.current);
      p = p - basePitch.current;

      setHeading(h);
      setPitch(p);
    };

    window.addEventListener("deviceorientation", handle);
    return () => window.removeEventListener("deviceorientation", handle);
  }, [started]);

  // 좌표 계산 (🔥 단순화)
  const getPos = () => {
    if (!moonInfo) return { x: 0, y: 0 };

    let azDiff = moonInfo.azimuth - heading;
    if (azDiff > 180) azDiff -= 360;
    if (azDiff < -180) azDiff += 360;

    let altDiff = moonInfo.altitude - pitch;

    return {
      x: -azDiff * 5,
      y: altDiff * 5, // 👉 자연스럽게 맞음
    };
  };

  const pos = getPos();

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
      {/* 📷 카메라 (🔥 핵심) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
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
    </div>
  );
}

export default App;