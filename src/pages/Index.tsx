import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import Architecture from "@/components/Architecture";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

const Index = () => {
  // Navigation handling for internal CTA clicks
  const handleCTAClick = () => {
    // Scroll to features or navigate to deploy
    const isGithubAuth = localStorage.getItem('devgem_github_token');
    if (isGithubAuth) {
      window.location.href = '/deploy';
    } else {
      window.location.href = '/auth';
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero onCTAClick={handleCTAClick} />
      <Features onAgentClick={handleCTAClick} />
      <HowItWorks onCTAClick={handleCTAClick} />
      <Architecture />
      <CTA onCTAClick={handleCTAClick} />
      <Footer />
    </div>
  );
};

export default Index;
