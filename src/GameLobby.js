import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { db } from './firebase';  // Import Firestore config
import { doc, setDoc, updateDoc, arrayUnion, getDoc, onSnapshot } from "firebase/firestore";

function GameLobby() {
  const { gameCode } = useParams();
  const location = useLocation();
  const [players, setPlayers] = useState([]);
  const [isCreator, setIsCreator] = useState(false);
  const [loading, setLoading] = useState(true);  // Track loading state

  const maxPlayers = 15;

  // Add the player to Firestore, create the game if it doesn't exist
  useEffect(() => {
    const newPlayer = location.state?.playerName;

    if (newPlayer) {
      const gameRef = doc(db, "games", gameCode);

      // Check if the document exists
      getDoc(gameRef).then((docSnapshot) => {
        if (docSnapshot.exists()) {
          // If the game exists, update the players array
          updateDoc(gameRef, {
            players: arrayUnion(newPlayer)
          });
        } else {
          // If the game doesn't exist, create the document with the new player
          setDoc(gameRef, {
            players: [newPlayer]
          });
        }
      }).finally(() => {
        // Set loading to false after the document has been handled
        setLoading(false);
      });

      setIsCreator(location.state.isCreator || false);  // Set isCreator flag
    }
  }, [gameCode, location.state]);

  // Firestore real-time listener to keep players in sync
  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);

    const unsubscribe = onSnapshot(gameRef, (doc) => {
      if (doc.exists()) {
        const gameData = doc.data();
        setPlayers(gameData.players || []);  // Update players in real-time
      }
    });

    return () => unsubscribe();  // Clean up listener on component unmount
  }, [gameCode]);

  // Display a loading spinner while data is loading
  if (loading) {
    return (
      <div className="loading-spinner">
        <h2>Loading game...</h2>
        {/* You can replace this with a fancier spinner */}
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="game-lobby">
      <h2>Game Lobby</h2>
      <p>Game Code: <strong>{gameCode}</strong></p>
      <div>
        <h3>Players ({players.length}/{maxPlayers}):</h3>
        <ul>
          {players.map((player, index) => (
            <li key={index}>{player}</li>
          ))}
        </ul>
      </div>
      
      {/* Only show the Start Game button if the player is the creator */}
      {isCreator && (
        <button onClick={() => alert('Start Game clicked!')} disabled={players.length === 0}>
          Start Game
        </button>
      )}
    </div>
  );
}

export default GameLobby;
