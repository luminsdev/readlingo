import { Sparkles } from "lucide-react";

import { RegisterForm } from "@/components/auth/register-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function RegisterPage() {
  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="bg-accent/15 text-accent flex size-12 items-center justify-center rounded-2xl">
          <Sparkles className="size-6" />
        </div>
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-semibold tracking-[0.24em] uppercase">
            Create account
          </p>
          <CardTitle className="font-serif text-4xl leading-tight">
            Build a reading habit that teaches back.
          </CardTitle>
          <CardDescription>
            Start with email and password now, then layer AI explanations and
            spaced repetition as each slice lands.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <RegisterForm />
      </CardContent>
    </Card>
  );
}
