import { useEffect, useRef, useState } from "react";
import SunCalc from "suncalc";

function App() {
  const videoRef = useRef(null);

  const [started, setStarted] = useState(false);
  const [location, setLocation] = useState(null);
  const [moonInfo, setMoonInfo] = useState(null);
  const [moonPhase, setMoonPhase] = useState(null);

  const [heading, setHeading] = useState(0);
  const [pitch, setPitch] = useState(0);

  const smoothHeading = useRef(0);
  const smoothPitch = useRef(0);
  const baseHeading = useRef(null);

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

  // 카메라
  useEffect(() => {
    if (!started) return;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        videoRef.current.srcObject = stream;
      });
  }, [started]);

  // 달 계산
  useEffect(() => {
    if (!location) return;

    const update = () => {
      const now = new Date();

      const moon = SunCalc.getMoonPosition(
        now,
        location.lat,
        location.lon
      );

      const illum = SunCalc.getMoonIllumination(now);

      let az = moon.azimuth * (180 / Math.PI);
      az = normalizeAngle(az + 180);

      setMoonInfo({
        azimuth: az,
        altitude: moon.altitude * (180 / Math.PI),
      });

      setMoonPhase(illum);
    };

    update();
    const id = setInterval(update, 2000);
    return () => clearInterval(id);
  }, [location]);

  // 센서
  useEffect(() => {
    if (!started) return;

    const smooth = (t, c) => c + (t - c) * 0.1;

    const smoothAngle = (t, c) => {
      let d = t - c;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      return c + d * 0.1;
    };

    const handle = (e) => {
      const rawH = e.alpha || 0;
      const rawP = e.beta || 0;

      if (baseHeading.current === null) {
        baseHeading.current = rawH;
      }

      let h = rawH - baseHeading.current;
      h = normalizeAngle(h);

      smoothHeading.current = smoothAngle(h, smoothHeading.current);
      smoothPitch.current = smooth(rawP, smoothPitch.current);

      setHeading(smoothHeading.current);
      setPitch(smoothPitch.current);
    };

    window.addEventListener("deviceorientation", handle);
    return () => window.removeEventListener("deviceorientation", handle);
  }, [started]);

  // 🔥 안정화된 좌표 계산
  const getPos = () => {
    if (!moonInfo) return { x: 0, y: 0 };

    let azDiff = moonInfo.azimuth - heading;
    if (azDiff > 180) azDiff -= 360;
    if (azDiff < -180) azDiff += 360;

    // 🔥 핵심: pitch 영향 줄이고 방향만 반영
    let altDiff = moonInfo.altitude - pitch;

    // 👉 과도한 튐 방지
    azDiff = Math.max(-90, Math.min(90, azDiff));
    altDiff = Math.max(-60, Math.min(60, altDiff));

    return {
      x: -azDiff * 4,
      y: altDiff * 3,
    };
  };

  const pos = getPos();

  const getMoon = (p) => {
    if (!p) return "🌙";
    if (p.phase < 0.5) return "🌔";
    return "🌖";
  };

  // 인트로
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
    <div style={{ width: "100vw", height: "100vh" }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          position: "fixed",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: "fixed",
          width: "100%",
          height: "100%",
          background: "rgba(0,0,20,0.3)",
          zIndex: 1,
        }}
      />

      {/* 🌙 항상 표시 */}
      <div
        style={{
          position: "absolute",
          left: `calc(50% + ${pos.x}px)`,
          top: `calc(50% + ${pos.y}px)`,
          transform: "translate(-50%, -50%)",
          fontSize: 50,
          zIndex: 3,
        }}
      >
        {getMoon(moonPhase)}
      </div>

      {/* 🧭 항상 표시 */}
      <div
        style={{
          position: "absolute",
          bottom: 30,
          width: "100%",
          textAlign: "center",
          color: "white",
          zIndex: 3,
        }}
      >
        N E S W
      </div>

      {/* 📊 항상 표시 */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          color: "white",
          background: "rgba(0,0,0,0.4)",
          padding: 10,
          borderRadius: 10,
          zIndex: 3,
        }}
      >
        방향: {heading.toFixed(1)}°<br />
        기울기: {pitch.toFixed(1)}°
      </div>
    </div>
  );
}

export default App;