// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract FaceIdentity {
    struct User {
        bytes faceHash;
        uint256 registrationDate;
        uint256 lastVerification;
        uint256 verificationCount;
    }
    
    mapping(address => User) public users;
    address public owner;
    
    event FaceRegistered(address indexed user, uint256 timestamp);
    event FaceVerified(address indexed user, bool success, uint256 timestamp);
    
    constructor() {
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    function registerFace(bytes memory _faceHash) external {
        require(users[msg.sender].faceHash.length == 0, "Already registered");
        require(_faceHash.length > 0, "Invalid face data");
        
        users[msg.sender] = User({
            faceHash: _faceHash,
            registrationDate: block.timestamp,
            lastVerification: 0,
            verificationCount: 0
        });
        
        emit FaceRegistered(msg.sender, block.timestamp);
    }
    
    function verifyUser(address _user, bool _isVerified) external onlyOwner {
        User storage user = users[_user];
        require(user.faceHash.length > 0, "User not registered");
        
        user.lastVerification = block.timestamp;
        if (_isVerified) {
            user.verificationCount += 1;
        }
        
        emit FaceVerified(_user, _isVerified, block.timestamp);
    }
    
    function getVerificationInfo(address _user) external view returns (
        uint256 registrationDate,
        uint256 lastVerification,
        uint256 verificationCount
    ) {
        User memory user = users[_user];
        return (
            user.registrationDate,
            user.lastVerification,
            user.verificationCount
        );
    }
    
    // For testing purposes - owner can delete a user
    function deleteUser(address _user) external onlyOwner {
        delete users[_user];
    }
}