"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Search } from "lucide-react";

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
    
    router.push(`/pe/${slug}`);
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-xl gap-2">
      <Input
        type="text"
        value={schoolName}
        onChange={(e) => setSchoolName(e.target.value)}
        placeholder="E.g., Ghana International School"
        className="h-12 text-lg"
        aria-label="School name"
      />
      <Button type="submit" size="lg" className="h-12">
        <Search className="mr-2 h-5 w-5" />
        Find
      </Button>
    </form>
  );
}
