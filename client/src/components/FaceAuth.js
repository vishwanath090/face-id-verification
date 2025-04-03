import React, { useState, useEffect, useRef } from 'react';
import * as faceapi from 'face-api.js';
import Web3 from 'web3';
import FaceID from '../contracts/FaceID.json';

const FaceAuth = () => {
  const videoRef = useRef();
  const canvasRef = useRef();
  const [web3, setWeb3] = useState(null);
  const [account, setAccount] = useState('');
  const [contract, setContract] = useState(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [faceRegistered, setFaceRegistered] = useState(false);
  const [networkError, setNetworkError] = useState('');

  // Initialize web3 and load models
  useEffect(() => {
    const init = async () => {
      try {
        // Load face-api.js models
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);
        setIsModelLoaded(true);

        // Initialize Web3
        if (window.ethereum) {
          const web3Instance = new Web3(window.ethereum);
          await window.ethereum.request({ method: 'eth_requestAccounts' });
          setWeb3(web3Instance);
          
          const accounts = await web3Instance.eth.getAccounts();
          setAccount(accounts[0]);
          
          // Initialize contract
          const networkId = await web3Instance.eth.net.getId();
          const deployedNetwork = FaceID.networks[networkId];
          
          if (!deployedNetwork) {
            setNetworkError('Contract not deployed on current network');
            return;
          }

          const contractInstance = new web3Instance.eth.Contract(
            FaceID.abi,
            deployedNetwork.address
          );
          setContract(contractInstance);
          
          // Check if face is already registered
          const user = await contractInstance.methods.users(accounts[0]).call();
          setFaceRegistered(user.faceHash && user.faceHash.length > 0);
        } else {
          setNetworkError('Please install MetaMask to use this application');
        }
      } catch (error) {
        console.error("Initialization error:", error);
        setNetworkError(error.message);
      }
    };

    init();
  }, []);

  // Start camera
  useEffect(() => {
    if (!isModelLoaded) return;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user', // Use front camera
            width: 640,
            height: 480
          },
          audio: false
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsCameraReady(true);
        }
      } catch (err) {
        console.error("Camera error:", err);
        setNetworkError('Camera access denied. Please enable camera permissions.');
      }
    };

    startCamera();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, [isModelLoaded]);

  const captureFaceDescriptor = async () => {
    if (!videoRef.current || !isModelLoaded) return null;

    const detections = await faceapi.detectAllFaces(
      videoRef.current,
      new faceapi.TinyFaceDetectorOptions()
    ).withFaceLandmarks().withFaceDescriptors();

    if (detections.length > 0) {
      return detections[0].descriptor;
    }
    return null;
  };

  const registerFace = async () => {
    setLoading(true);
    setVerificationStatus(null);
    try {
      const descriptor = await captureFaceDescriptor();
      if (!descriptor) throw new Error("No face detected");

      // Convert Float32Array to bytes for blockchain storage
      const descriptorBytes = web3.utils.bytesToHex(new Float32Array(descriptor).buffer);

      await contract.methods.registerFace(descriptorBytes)
        .send({ from: account });
      
      setFaceRegistered(true);
      alert("Face registered successfully!");
    } catch (error) {
      console.error("Registration failed:", error);
      setNetworkError("Registration failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyFace = async () => {
    setLoading(true);
    setVerificationStatus(null);
    try {
      const currentDescriptor = await captureFaceDescriptor();
      if (!currentDescriptor) throw new Error("No face detected");

      // Get stored descriptor from blockchain
      const user = await contract.methods.users(account).call();
      if (!user.faceHash || user.faceHash.length === 0) {
        throw new Error("No registered face found");
      }

      // Convert stored bytes back to Float32Array
      const storedDescriptor = new Float32Array(
        web3.utils.hexToBytes(user.faceHash)
      );

      // Calculate similarity
      const distance = faceapi.euclideanDistance(
        storedDescriptor,
        currentDescriptor
      );

      // Verification threshold (adjust as needed)
      const isVerified = distance < 0.5;
      setVerificationStatus(isVerified);

      if (isVerified) {
        alert("Identity verified successfully!");
      } else {
        alert("Verification failed. Please try again.");
      }
    } catch (error) {
      console.error("Verification failed:", error);
      setNetworkError("Verification failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="face-auth-container">
      <h1>Decentralized Face Identity</h1>
      
      {networkError && (
        <div className="error-message">
          {networkError}
        </div>
      )}

      <div className="camera-container">
        <video 
          ref={videoRef}
          width="640" 
          height="480"
          autoPlay
          muted
          playsInline
          style={{ display: isCameraReady ? 'block' : 'none' }}
        />
        {!isCameraReady && <p>Loading camera...</p>}
        <canvas 
          ref={canvasRef} 
          width="640" 
          height="480"
          style={{ display: 'none' }}
        />
      </div>

      <div className="status">
        <p>Wallet: {account || 'Not connected'}</p>
        <p>Face {faceRegistered ? 'Registered' : 'Not Registered'}</p>
        {verificationStatus !== null && (
          <p>Verification: {verificationStatus ? '✅ Verified' : '❌ Failed'}</p>
        )}
      </div>

      <div className="controls">
        <button 
          onClick={registerFace} 
          disabled={!isModelLoaded || !web3 || loading || faceRegistered}
        >
          {loading ? 'Processing...' : 'Register Face'}
        </button>
        <button 
          onClick={verifyFace} 
          disabled={!isModelLoaded || !web3 || loading || !faceRegistered}
        >
          {loading ? 'Verifying...' : 'Verify Identity'}
        </button>
      </div>
    </div>
  );
};

export default FaceAuth;