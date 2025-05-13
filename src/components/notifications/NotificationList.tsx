import React, { useState } from "react";
import {
	useGetUserNotificationsQuery,
	useMarkNotificationsAsReadMutation,
	useDeleteNotificationsMutation,
	NotificationType,
} from "@/redux/api/notificationApi";
import {
	Badge,
	Box,
	Button,
	IconButton,
	List,
	ListItem,
	ListItemText,
	Typography,
	CircularProgress,
	Pagination,
} from "@mui/material";
import {
	NotificationsOutlined,
	CheckCircleOutline,
	Delete,
} from "@mui/icons-material";
import { formatDistanceToNow } from "date-fns";

const NotificationList = () => {
	const [page, setPage] = useState(1);
	const [selectedNotifications, setSelectedNotifications] = useState<string[]>(
		[]
	);

	const { data, isLoading, isFetching } = useGetUserNotificationsQuery({
		page,
		limit: 10,
	});

	const [markAsRead] = useMarkNotificationsAsReadMutation();
	const [deleteNotifications] = useDeleteNotificationsMutation();

	const handleMarkAsRead = async () => {
		if (selectedNotifications.length > 0) {
			await markAsRead({ notificationIds: selectedNotifications });
			setSelectedNotifications([]);
		}
	};

	const handleDelete = async () => {
		if (selectedNotifications.length > 0) {
			await deleteNotifications({ notificationIds: selectedNotifications });
			setSelectedNotifications([]);
		}
	};

	const handlePageChange = (event: unknown, value: number) => {
		setPage(value);
	};

	const getNotificationIcon = (type: NotificationType) => {
		switch (type) {
			case NotificationType.DONATION_RECEIVED:
				return "💰";
			case NotificationType.CAMPAIGN_CREATED:
				return "🎯";
			case NotificationType.FEEDBACK_RECEIVED:
				return "⭐";
			case NotificationType.FEEDBACK_RESPONSE:
				return "✉️";
			default:
				return "📢";
		}
	};

	if (isLoading) {
		return (
			<Box display="flex" justifyContent="center" p={4}>
				<CircularProgress />
			</Box>
		);
	}

	return (
		<Box>
			<Box
				display="flex"
				justifyContent="space-between"
				alignItems="center"
				mb={2}
				p={2}
			>
				<Typography variant="h6" component="h2">
					Notifications{" "}
					{data?.unreadCount ? (
						<Badge badgeContent={data.unreadCount} color="primary" />
					) : null}
				</Typography>
				<Box>
					<Button
						startIcon={<CheckCircleOutline />}
						onClick={handleMarkAsRead}
						disabled={selectedNotifications.length === 0}
						sx={{ mr: 1 }}
					>
						Mark as Read
					</Button>
					<Button
						startIcon={<Delete />}
						onClick={handleDelete}
						disabled={selectedNotifications.length === 0}
						color="error"
					>
						Delete
					</Button>
				</Box>
			</Box>

			<List>
				{data?.data.map((notification) => (
					<ListItem
						key={notification._id}
						sx={{
							bgcolor: notification.isRead ? "transparent" : "action.hover",
							mb: 1,
							borderRadius: 1,
						}}
						secondaryAction={
							<IconButton
								edge="end"
								onClick={() =>
									setSelectedNotifications((prev) =>
										prev.includes(notification._id)
											? prev.filter((id) => id !== notification._id)
											: [...prev, notification._id]
									)
								}
							>
								<NotificationsOutlined
									color={
										selectedNotifications.includes(notification._id)
											? "primary"
											: "action"
									}
								/>
							</IconButton>
						}
					>
						<ListItemText
							primary={
								<Box display="flex" alignItems="center" gap={1}>
									<span>{getNotificationIcon(notification.type)}</span>
									<Typography variant="subtitle1">
										{notification.title}
									</Typography>
								</Box>
							}
							secondary={
								<>
									<Typography variant="body2" color="text.secondary">
										{notification.message}
									</Typography>
									<Typography variant="caption" color="text.secondary">
										{formatDistanceToNow(new Date(notification.createdAt), {
											addSuffix: true,
										})}
									</Typography>
								</>
							}
						/>
					</ListItem>
				))}
			</List>

			{data?.pagination.pages > 1 && (
				<Box display="flex" justifyContent="center" mt={2}>
					<Pagination
						count={data.pagination.pages}
						page={page}
						onChange={handlePageChange}
						disabled={isFetching}
					/>
				</Box>
			)}
		</Box>
	);
};

export default NotificationList;
