import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { db } from './firebase';  // Firestore config
import { doc, getDoc } from "firebase/firestore";  // Firestore functions

function Countdown() {
  const { gameCode } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const playerName = location.state?.playerName || '';
  const isCreator = location.state?.isCreator || false;  // Retrieve isCreator from location state
  const [countdown, setCountdown] = useState(3);
  const [role, setRole] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    if (countdown === 0) {
      clearInterval(timer);

      const gameRef = doc(db, "games", gameCode);
      getDoc(gameRef).then((docSnapshot) => {
        if (docSnapshot.exists()) {
          const gameData = docSnapshot.data();
          const playerRole = gameData.roles[playerName];
          setRole(playerRole);
        }
      });
    }

    return () => clearInterval(timer);  // Clean up the timer on component unmount
  }, [countdown, gameCode, playerName]);

  const endGameRound = () => {
    // Navigate all players back to the lobby
    navigate(`/lobby/${gameCode}`, { state: { playerName, isCreator } });
  };

  if (countdown > 0) {
    return <div>Game starting in... {countdown}</div>;
  }

  return (
    <div>
      <h2>{role === 'Imposter' ? 'You are the Imposter!' : 'You are a Crewmate!'}</h2>
      
      {isCreator && (
        <button onClick={endGameRound}>
          End Game Round
        </button>
      )}
    </div>
  );
}

export default Countdown;
