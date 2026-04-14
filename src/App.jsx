import { useEffect, useMemo, useRef, useState } from "react";
import SunCalc from "suncalc";

function App() {
  const videoRef = useRef(null);

  const [started, setStarted] = useState(false);
  const [location, setLocation] = useState(null);
  const [moonInfo, setMoonInfo] = useState(null);
  const [moonPhase, setMoonPhase] = useState(null);
  const [moonTimes, setMoonTimes] = useState(null);

  const [heading, setHeading] = useState(0);
  const [pitch, setPitch] = useState(0);

  const [cameraDenied, setCameraDenied] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const baseHeading = useRef(null);
  const basePitch = useRef(null);
  const smoothHeading = useRef(0);
  const smoothPitch = useRef(0);

  const normalizeAngle = (angle) => {
    let result = angle % 360;
    if (result < 0) result += 360;
    return result;
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const smoothAngle = (target, current) => {
    let diff = target - current;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return current + diff * 0.08;
  };

  const smoothValue = (target, current, factor = 0.12) => {
    return current + (target - current) * factor;
  };

  const formatTime = (dateValue) => {
    if (!dateValue) return "없음";
    try {
      return new Date(dateValue).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "없음";
    }
  };

  const getMoonStatus = (moonInfo) => {
    if (!moonInfo) return "계산 중";

    if (moonInfo.altitude < 0) return "❌ 지금 안보임";
    if (moonInfo.altitude < 10) return "🌫️ 낮게 떠 있음";
    if (moonInfo.altitude < 40) return "🌙 잘 보임";
    return "🌕 높이 떠 있음";
  };  

  const getNextMoonTimes = (lat, lon) => {
    const now = new Date();

    const today = SunCalc.getMoonTimes(now, lat, lon);
    const tomorrow = SunCalc.getMoonTimes(
      new Date(now.getTime() + 86400000),
      lat,
      lon
    );

    const nextRise =
      today.rise && today.rise > now ? today.rise : tomorrow.rise;

    const nextSet =
      today.set && today.set > now ? today.set : tomorrow.set;

    return { nextRise, nextSet };
  };

  const getVisibilityText = () => {
    if (!moonInfo) return "계산 중";
    if (moonInfo.altitude < 0) return "지평선 아래";
    if (moonInfo.altitude < 10) return "낮게 떠 있음";
    if (moonInfo.altitude < 40) return "보이기 좋은 높이";
    return "높이 떠 있음";
  };

  const fallbackBackground = useMemo(() => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 2400">
        <defs>
          <linearGradient id="bg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="#0b1026"/>
            <stop offset="55%" stop-color="#151d45"/>
            <stop offset="100%" stop-color="#26356a"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="2400" fill="url(#bg)"/>
        <circle cx="940" cy="320" r="110" fill="#f8f2c7" opacity="0.95"/>
        <circle cx="980" cy="300" r="110" fill="#151d45"/>
        <circle cx="140" cy="180" r="2" fill="white" opacity="0.9"/>
        <circle cx="260" cy="260" r="3" fill="white" opacity="0.8"/>
        <circle cx="420" cy="150" r="2" fill="white" opacity="0.7"/>
        <circle cx="620" cy="280" r="2" fill="white" opacity="0.9"/>
        <circle cx="760" cy="180" r="3" fill="white" opacity="0.75"/>
        <circle cx="1080" cy="220" r="2" fill="white" opacity="0.8"/>
        <circle cx="150" cy="520" r="2" fill="white" opacity="0.7"/>
        <circle cx="360" cy="430" r="3" fill="white" opacity="0.85"/>
        <circle cx="570" cy="560" r="2" fill="white" opacity="0.8"/>
        <circle cx="790" cy="500" r="2" fill="white" opacity="0.7"/>
        <circle cx="980" cy="610" r="3" fill="white" opacity="0.9"/>
        <path d="M0 1800 C220 1650 420 1700 620 1800 C800 1890 980 1890 1200 1760 L1200 2400 L0 2400 Z" fill="#152449"/>
        <path d="M0 1950 C260 1840 430 1880 640 1980 C860 2080 1010 2060 1200 1930 L1200 2400 L0 2400 Z" fill="#0d1732"/>
      </svg>
    `;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  }, []);

  const startApp = async () => {
    try {
      if (
        typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function"
      ) {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== "granted") {
          alert("센서 권한이 허용되지 않았어요.");
          return;
        }
      }
      setStarted(true);
    } catch (error) {
      console.error("센서 권한 요청 실패:", error);
      setStarted(true);
    }
  };

  useEffect(() => {
    if (!started) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
      },
      (err) => {
        console.error("위치 가져오기 실패:", err);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 10000,
      }
    );
  }, [started]);

  useEffect(() => {
    if (!started) return;

    let stream;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraReady(true);
          setCameraDenied(false);
        }
      } catch (error) {
        console.error("카메라 시작 실패:", error);
        setCameraDenied(true);
        setCameraReady(false);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [started]);

  useEffect(() => {
    if (!location) return;

    const updateMoon = () => {
      const now = new Date();
      const moonPos = SunCalc.getMoonPosition(now, location.lat, location.lon);
      const illum = SunCalc.getMoonIllumination(now);
      const times = SunCalc.getMoonTimes(now, location.lat, location.lon);

      let azimuthDeg = (moonPos.azimuth * 180) / Math.PI;
      azimuthDeg = normalizeAngle(azimuthDeg + 180);

      const altitudeDeg = (moonPos.altitude * 180) / Math.PI;

      setMoonInfo({
        azimuth: azimuthDeg,
        altitude: altitudeDeg,
      });

      setMoonPhase(illum);
      setMoonTimes(times);
    };

    updateMoon();
    const intervalId = setInterval(updateMoon, 2000);
    return () => clearInterval(intervalId);
  }, [location]);

  useEffect(() => {
    if (!started) return;

    const handleOrientation = (event) => {
      const rawHeading = event.alpha ?? 0;
      const rawPitch = event.beta ?? 0;

      if (baseHeading.current === null) {
        baseHeading.current = rawHeading;
      }
      if (basePitch.current === null) {
        basePitch.current = rawPitch;
      }

      const correctedHeading = normalizeAngle(rawHeading - baseHeading.current);
      const correctedPitch = rawPitch - basePitch.current;

      smoothHeading.current = smoothAngle(
        correctedHeading,
        smoothHeading.current
      );
      smoothPitch.current = smoothValue(correctedPitch, smoothPitch.current);

      setHeading(normalizeAngle(smoothHeading.current));
      setPitch(smoothPitch.current);
    };

    window.addEventListener("deviceorientation", handleOrientation, true);

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation, true);
    };
  }, [started]);

  const getMoonScreenPosition = () => {
    if (!moonInfo) {
      return { x: 0, y: 0 };
    }

    let azDiff = moonInfo.azimuth - heading;
    if (azDiff > 180) azDiff -= 360;
    if (azDiff < -180) azDiff += 360;

    const altDiff = moonInfo.altitude - pitch;

    const limitedAz = clamp(azDiff, -90, 90);
    const limitedAlt = clamp(altDiff, -60, 60);

    return {
      x: -limitedAz * 4.5,
      y: -limitedAlt * 4.5,
    };
  };

  const getMoonEmoji = (phase) => {
    if (!phase) return "🌙";
    if (phase.phase < 0.03 || phase.phase > 0.97) return "🌑";
    if (phase.phase < 0.22) return "🌒";
    if (phase.phase < 0.28) return "🌓";
    if (phase.phase < 0.47) return "🌔";
    if (phase.phase < 0.53) return "🌕";
    if (phase.phase < 0.72) return "🌖";
    if (phase.phase < 0.78) return "🌗";
    return "🌘";
  };

  const moonPos = getMoonScreenPosition();

  const moonAngle = useMemo(() => {
    if (!moonInfo) return 0;
    let diff = moonInfo.azimuth - heading;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return diff;
  }, [moonInfo, heading]);

const [nextTimes, setNextTimes] = useState(null);

  useEffect(() => {
    if (!location) return;

    const update = () => {
      const now = new Date();

      const moon = SunCalc.getMoonPosition(now, location.lat, location.lon);
      const illum = SunCalc.getMoonIllumination(now);

      let az = moon.azimuth * (180 / Math.PI);
      az = normalizeAngle(az + 180);

      setMoonInfo({
        azimuth: az,
        altitude: moon.altitude * (180 / Math.PI),
      });

      setMoonPhase(illum);

      // ⭐ 여기 추가
      const next = getNextMoonTimes(location.lat, location.lon);
      setNextTimes(next);
    };

    update();
    const id = setInterval(update, 2000);
    return () => clearInterval(id);
  }, [location]);  

  if (!started) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(180deg, #0b1026 0%, #1a2147 100%)",
          overflow: "hidden",
        }}
      >
        <button
          onClick={startApp}
          style={{
            width: 220,
            height: 220,
            borderRadius: "50%",
            border: "none",
            background: "rgba(255,255,255,0.12)",
            color: "#fff",
            fontSize: 22,
            lineHeight: 1.4,
            cursor: "pointer",
            boxShadow: "0 0 30px rgba(255,255,210,0.35)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <div style={{ fontSize: 52, marginBottom: 8 }}>🌙</div>
          달님,
          <br />
          어디있어요?
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: "#000",
      }}
    >
      {!cameraReady && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundImage: fallbackBackground,
            backgroundSize: "cover",
            backgroundPosition: "center",
            zIndex: 0,
          }}
        />
      )}

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
          background: "#000",
          opacity: cameraReady ? 1 : 0,
        }}
      />

      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(6, 10, 30, 0.22)",
          zIndex: 1,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: `calc(50% + ${moonPos.x}px)`,
          top: `calc(50% + ${moonPos.y}px)`,
          transform: "translate(-50%, -50%)",
          fontSize: 56,
          zIndex: 5,
          filter: "drop-shadow(0 0 12px rgba(255,255,210,0.9))",
          pointerEvents: "none",
        }}
      >
        {getMoonEmoji(moonPhase)}
      </div>

      {/* 중앙 AR 화살표: 방향 반전 적용 */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) rotate(${-moonAngle}deg)`,
          zIndex: 7,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: "24px solid transparent",
            borderRight: "24px solid transparent",
            borderBottom: "56px solid rgba(126,200,255,0.95)",
            filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.35))",
          }}
        />
        <div
          style={{
            width: 18,
            height: 34,
            background: "rgba(126,200,255,0.95)",
            margin: "0 auto",
            marginTop: -4,
            borderRadius: "0 0 10px 10px",
            boxShadow: "0 6px 14px rgba(0,0,0,0.2)",
          }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          top: 18,
          left: 18,
          zIndex: 6,
          color: "#fff",
          background: "rgba(255,255,255,0.14)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 18,
          padding: "12px 14px",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          fontSize: 14,
          lineHeight: 1.6,
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        }}
      >
      <div>
        현재 상태: {getMoonStatus(moonInfo)}
      </div>

      <div>
        다음 월출:{" "}
        {nextTimes?.nextRise
          ? new Date(nextTimes.nextRise).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "없음"}
      </div>

      <div>
        다음 월몰:{" "}
        {nextTimes?.nextSet
          ? new Date(nextTimes.nextSet).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "없음"}
      </div>        
        <div>방향: {heading.toFixed(1)}°</div>
        <div>기울기: {pitch.toFixed(1)}°</div>
        <div>
          위치:{" "}
          {location
            ? `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}`
            : "확인 중"}
        </div>
        <div>
          달 고도: {moonInfo ? `${moonInfo.altitude.toFixed(1)}°` : "계산 중"}
        </div>
        <div>현재 상태: {getVisibilityText()}</div>
        {cameraDenied && <div>카메라 미허용: 임시 배경 사용 중</div>}
      </div>

      <div
        style={{
          position: "absolute",
          right: 18,
          top: 18,
          zIndex: 6,
          color: "#fff",
          background: "rgba(255,255,255,0.14)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 18,
          padding: "10px 14px",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          fontSize: 14,
          lineHeight: 1.6,
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        }}
      >
        <div>
          {moonPhase
            ? `밝기 ${(moonPhase.fraction * 100).toFixed(1)}%`
            : "달 밝기 계산 중"}
        </div>
        <div>
          뜨는 시간: {moonTimes ? formatTime(moonTimes.rise) : "계산 중"}
        </div>
        <div>
          지는 시간: {moonTimes ? formatTime(moonTimes.set) : "계산 중"}
        </div>
        {moonTimes?.alwaysUp && <div>오늘 계속 떠 있음</div>}
        {moonTimes?.alwaysDown && <div>오늘 계속 지평선 아래</div>}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 22,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 6,
        }}
      >
        <div
          style={{
            width: 138,
            height: 138,
            borderRadius: "50%",
            position: "relative",
            background:
              "radial-gradient(circle at 35% 30%, rgba(255,245,210,0.95) 0%, rgba(244,231,183,0.92) 38%, rgba(217,203,157,0.92) 70%, rgba(180,166,124,0.9) 100%)",
            border: "2px solid rgba(255,255,255,0.35)",
            boxShadow:
              "0 0 22px rgba(255,245,210,0.18), 0 14px 28px rgba(0,0,0,0.28), inset -10px -10px 22px rgba(120,100,60,0.18), inset 10px 10px 20px rgba(255,255,255,0.18)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 14,
              borderRadius: "50%",
              border: "1px dashed rgba(255,255,255,0.22)",
            }}
          />

          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: `rotate(${-heading}deg)`,
              willChange: "transform",
              backfaceVisibility: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 10,
                left: "50%",
                transform: "translateX(-50%)",
                color: "#d85b5b",
                fontWeight: "bold",
                fontSize: 18,
                textShadow: "0 0 8px rgba(216,91,91,0.25)",
              }}
            >
              N
            </div>

            <div
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#5d5a54",
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              E
            </div>

            <div
              style={{
                position: "absolute",
                bottom: 10,
                left: "50%",
                transform: "translateX(-50%)",
                color: "#5d5a54",
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              S
            </div>

            <div
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#5d5a54",
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              W
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 0,
              height: 0,
              borderLeft: "9px solid transparent",
              borderRight: "9px solid transparent",
              borderBottom: "48px solid #ef6b6b",
              transform: "translate(-50%, -100%)",
              filter: "drop-shadow(0 0 6px rgba(239,107,107,0.28))",
              zIndex: 3,
            }}
          />

          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 0,
              height: 0,
              borderLeft: "7px solid transparent",
              borderRight: "7px solid transparent",
              borderTop: "40px solid rgba(96,96,108,0.78)",
              transform: "translate(-50%, 0%)",
              filter: "drop-shadow(0 0 4px rgba(0,0,0,0.12))",
              zIndex: 3,
            }}
          />

          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "#fffdf2",
              transform: "translate(-50%, -50%)",
              boxShadow:
                "0 0 10px rgba(255,255,255,0.45), inset 0 0 4px rgba(255,255,255,0.9)",
              zIndex: 4,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default App;