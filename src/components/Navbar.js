import React, { useState, useRef, useEffect } from "react";
import styled from "styled-components";
import { ChevronDown, User } from "lucide-react";
import { Link } from "react-router-dom"; // Use React Router for navigation
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

const HeaderContainer = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 4rem;
  width: 100%;
  padding: 0 1rem;
  padding-left: 40px;
  background: #fff;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const Logo = styled(Link)`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.125rem;
  font-weight: 600;
  text-decoration: none;
  color: inherit;

  &:hover {
    text-decoration: underline;
  }
`;

const Nav = styled.nav`
  display: none;
  align-items: center;
  gap: 1.5rem;
  padding-right: 25px;

  @media (min-width: 768px) {
    display: flex;
  }
`;

const NavLink = styled(Link)`
  font-size: 0.875rem;
  font-weight: 500;
  color: inherit;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
    text-underline-offset: 4px;
    color: var(--color-accent);
    transition: color 0.2s ease-in-out;
  }
`;

const CreditDisplay = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const ProfileIcon = styled(Link)`
  display: flex;
  align-items: center;
  justify-content: center;
  color: #374151;
  text-decoration: none;
  transition: color 0.2s ease-in-out;
  
  &:hover {
    color: #3b82f6;
  }
`;



export default function Navbar() {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const [user, setUser] = useState(null);
  const [userCredits, setUserCredits] = useState(0);

  useEffect(() => {
    const auth = getAuth();
    let unsubscribeCredits = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        
        // Set up real-time listener for user credits
        const userRef = doc(db, "users", currentUser.uid);
        unsubscribeCredits = onSnapshot(userRef, (doc) => {
          if (doc.exists()) {
            const userData = doc.data();
            setUserCredits(userData.searchCredit || 0);
          }
        }, (error) => {
          console.error("Error listening to user credits:", error);
        });
      } else {
        setUser(null);
        setUserCredits(0);
        if (unsubscribeCredits) {
          unsubscribeCredits();
          unsubscribeCredits = null;
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeCredits) {
        unsubscribeCredits();
      }
    };
  }, []);



  return (
    <>
      <HeaderContainer>
        <Logo to="/">Offers</Logo>
        <Nav>
          <NavLink to="/">Home</NavLink>
          <NavLink to="/offerLetterUpload">Upload</NavLink>
          <NavLink to="/upgrade">Upgrade</NavLink>
          {user && (
            <CreditDisplay>
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {userCredits} Credits
            </CreditDisplay>
          )}
          {user ? (
            <ProfileIcon to="/profile" title="Go to Profile">
              <User className="h-5 w-5" />
            </ProfileIcon>
          ) : (
            <NavLink to="/auth">Sign In</NavLink>
          )}
        </Nav>
      </HeaderContainer>
    </>
  );
}
