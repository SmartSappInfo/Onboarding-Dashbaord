"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

export default function FindSchoolForm() {
  const [schoolName, setSchoolName] = useState("");
  const router = useRouter();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!schoolName.trim()) return;

    const slug = schoolName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    
    router.push(`/meetings/${slug}`);
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-xl gap-2">
      <Input
        type="text"
        value={schoolName}
        onChange={(e) => setSchoolName(e.target.value)}
        placeholder="Enter your school's name"
        className="h-12 text-lg"
        aria-label="School name"
      />
      <Button type="submit" size="lg" className="h-12">
        Find my school
      </Button>
    </form>
  );
}
