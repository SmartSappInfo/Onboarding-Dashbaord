import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export default function DashboardCard({
  title,
  description,
  children,
  className,
  ...props
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="h-full"
    >
      <Card 
        className={cn(
          "h-full rounded-[2rem] border-none bg-background/50 backdrop-blur-xl shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden relative group",
          className
        )} 
        {...props}
      >
        {/* Premium internal glow */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-sm font-semibold tracking-tight uppercase opacity-80">{title}</CardTitle>
          {description && (
            <CardDescription className="text-[10px] font-bold text-muted-foreground/60 leading-relaxed uppercase tracking-wider">
              {description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex-grow pt-0">
          {children}
        </CardContent>
      </Card>
    </motion.div>
  )
}
