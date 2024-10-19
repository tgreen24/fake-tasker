import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { db } from './firebase';  // Firestore config
import { doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";  // Firestore functions

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

  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);
  
    // Set up Firestore listener to detect when game is deleted
    const unsubscribe = onSnapshot(gameRef, (docSnapshot) => {
      if (!docSnapshot.exists()) {
        console.log("Game deleted. Navigating to home...");
        navigate("/");
      }
    });
  
    return () => unsubscribe();  // Clean up the listener when the component unmounts
  }, [gameCode, navigate]);

  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);

    // Set up Firestore listener to detect when game is ended
    const unsubscribe = onSnapshot(gameRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const gameData = docSnapshot.data();

        // If gameStarted is false, navigate everyone back to the lobby
        if (!gameData.gameStarted) {
          console.log("Game round ended. Navigating back to lobby...");
          navigate(`/lobby/${gameCode}`, { state: { playerName, isCreator, gameStarted: false } });
        }
      }
    });

    return () => unsubscribe();  // Clean up the listener when the component unmounts
  }, [gameCode, navigate, playerName, isCreator]);


  const endGameRound = async () => {
    const gameRef = doc(db, "games", gameCode);

    // Set roundEnded to true in Firestore to notify all players
    await updateDoc(gameRef, { gameStarted: false });
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
