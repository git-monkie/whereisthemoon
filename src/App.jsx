import { useEffect, useRef, useState } from "react";
import SunCalc from "suncalc";

function App() {
  const videoRef = useRef(null);

  const [location, setLocation] = useState(null);
  const [moonInfo, setMoonInfo] = useState(null);
  const [moonPhase, setMoonPhase] = useState(null);
  const [heading, setHeading] = useState(0);
  const [pitch, setPitch] = useState(0);

  let smoothHeading = useRef(0);
  let smoothPitch = useRef(0);

  // 📍 위치
  useEffect(() => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setLocation({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
      });
    });
  }, []);

  // 📷 카메라
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        videoRef.current.srcObject = stream;
      });
  }, []);

  // 🌙 달 계산
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

      setMoonInfo({
        azimuth: moon.azimuth * (180 / Math.PI),
        altitude: moon.altitude * (180 / Math.PI),
      });

      setMoonPhase(illum);
    };

    update();
    const interval = setInterval(update, 2000);

    return () => clearInterval(interval);
  }, [location]);

  // 🧭 센서 (보정 포함)
  useEffect(() => {
    const smooth = (target, current, factor = 0.1) => {
      return current + (target - current) * factor;
    };

    const smoothAngle = (target, current) => {
      let diff = target - current;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      return current + diff * 0.1;
    };

    const handleOrientation = (e) => {
      const rawHeading = e.alpha || 0;
      const rawPitch = e.beta || 0;

      smoothHeading.current = smoothAngle(rawHeading, smoothHeading.current);
      smoothPitch.current = smooth(rawPitch, smoothPitch.current);

      setHeading(smoothHeading.current);
      setPitch(smoothPitch.current);
    };

    window.addEventListener("deviceorientation", handleOrientation);

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, []);

  // 📱 iOS 권한
  const requestPermission = async () => {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      await DeviceOrientationEvent.requestPermission();
    }
  };

  // 🌙 달 위치 → 화면 좌표
  const getMoonScreenPosition = () => {
    if (!moonInfo) return { x: 0, y: 0 };

    let az = moonInfo.azimuth + 180;
    if (az > 360) az -= 360;

    let azDiff = az - heading;

    if (azDiff > 180) azDiff -= 360;
    if (azDiff < -180) azDiff += 360;

    const altDiff = moonInfo.altitude - pitch;

    const x = -azDiff * 4;  // 좌우 민감도
    const y = -altDiff * 5; // 상하 민감도

    return { x, y };
  };

  const pos = getMoonScreenPosition();

  // 🌙 위상
  const getMoonPhaseName = (phase) => {
    if (phase < 0.03 || phase > 0.97) return "🌑";
    if (phase < 0.22) return "🌒";
    if (phase < 0.28) return "🌓";
    if (phase < 0.47) return "🌔";
    if (phase < 0.53) return "🌕";
    if (phase < 0.72) return "🌖";
    if (phase < 0.78) return "🌗";
    return "🌘";
  };

  return (
    <div style={{ overflow: "hidden" }}>
      {/* 📷 카메라 */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          objectFit: "cover",
          zIndex: 0,
        }}
      />

      {/* 🌙 달 위치 */}
      {moonInfo && (
        <div
          style={{
            position: "absolute",
            left: `calc(50% + ${pos.x}px)`,
            top: `calc(50% + ${pos.y}px)`,
            transform: "translate(-50%, -50%)",
            fontSize: "50px",
            zIndex: 2,
          }}
        >
          {moonPhase && getMoonPhaseName(moonPhase.phase)}
        </div>
      )}

      {/* 👉 화살표 */}
      {moonInfo && (
        <div
          style={{
            position: "absolute",
            bottom: "20%",
            left: "50%",
            transform: `translateX(-50%) rotate(${
              moonInfo.azimuth - heading
            }deg)`,
            fontSize: "40px",
            zIndex: 2,
          }}
        >
          ↑
        </div>
      )}

      {/* 🧭 나침반 */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          width: "100%",
          textAlign: "center",
          fontSize: "20px",
          transform: `rotate(${-heading}deg)`,
          zIndex: 2,
          color: "white",
        }}
      >
        N E S W
      </div>

      {/* 📊 정보 UI */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          color: "white",
          zIndex: 2,
          background: "rgba(0,0,0,0.5)",
          padding: 10,
          borderRadius: 10,
        }}
      >
        <div>방향: {heading.toFixed(1)}°</div>
        {moonInfo && (
          <>
            <div>달 방위: {moonInfo.azimuth.toFixed(1)}°</div>
            <div>고도: {moonInfo.altitude.toFixed(1)}°</div>
          </>
        )}
        {moonPhase && (
          <div>밝기: {(moonPhase.fraction * 100).toFixed(1)}%</div>
        )}
      </div>

      {/* 📱 권한 버튼 */}
      <button
        onClick={requestPermission}
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          zIndex: 2,
        }}
      >
        센서 허용
      </button>
    </div>
  );
}

export default App;