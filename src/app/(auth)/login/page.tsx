import { BookOpenText } from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="bg-accent/15 text-accent flex size-12 items-center justify-center rounded-2xl">
          <BookOpenText className="size-6" />
        </div>
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-semibold tracking-[0.24em] uppercase">
            Welcome back
          </p>
          <CardTitle className="font-serif text-4xl leading-tight">
            Step back into the story.
          </CardTitle>
          <CardDescription>
            Keep your reading, AI explanations, and future review queue in one
            quiet workspace.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  );
}
