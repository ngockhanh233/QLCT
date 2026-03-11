package com.qlct

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.widget.RemoteViews

class QuickAddWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)

        for (appWidgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        if (ACTION_OPEN_QUICK_ADD == intent.action) {
            openQuickAddScreen(context)
        } else if (AppWidgetManager.ACTION_APPWIDGET_UPDATE == intent.action) {
            val manager = AppWidgetManager.getInstance(context)
            val componentName = ComponentName(context, QuickAddWidgetProvider::class.java)
            val ids = manager.getAppWidgetIds(componentName)
            onUpdate(context, manager, ids)
        }
    }

    private fun updateWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val views = RemoteViews(context.packageName, R.layout.widget_quick_add)

        val intent = Intent(context, QuickAddWidgetProvider::class.java).apply {
            action = ACTION_OPEN_QUICK_ADD
            data = Uri.parse("qlct://widget-open-add-transaction")
        }

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            appWidgetId,
            intent,
            flags
        )

        // Cho phép bấm cả widget hoặc nút "Thêm" đều mở app
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)
        views.setOnClickPendingIntent(R.id.widget_add_button, pendingIntent)

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun openQuickAddScreen(context: Context) {
        val uri = Uri.parse("qlct://add-transaction")
        val intent = Intent(Intent.ACTION_VIEW, uri).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        context.startActivity(intent)
    }

    companion object {
        private const val ACTION_OPEN_QUICK_ADD = "com.qlct.ACTION_OPEN_QUICK_ADD"
    }
}

